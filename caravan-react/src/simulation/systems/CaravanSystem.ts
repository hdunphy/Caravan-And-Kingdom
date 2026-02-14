import { WorldState, Resources, AgentEntity, AgentType, ResourceType } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { HexUtils } from '../../utils/HexUtils.ts';
import { Pathfinding } from '../Pathfinding.ts';
import { Logger } from '../../utils/Logger.ts';
import { BlackboardDispatcher } from '../ai/BlackboardDispatcher';
import { TradeStrategy } from '../ai/TradeStrategy';

export const CaravanSystem = {
    // Determine spawn location (Settlement or from IDLE pool)
    spawn(state: WorldState, startHexId: string, targetHexId: string, type: AgentType = 'Caravan', config?: GameConfig): AgentEntity | null {
        const startHex = state.map[startHexId];
        const targetHex = state.map[targetHexId];

        if (!startHex || !targetHex) return null;

        const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);
        if ((!path || path.length === 0) && startHexId !== targetHexId) return null;

        const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        let agent: AgentEntity;

        const base = {
            id,
            ownerId: 'player_1',
            position: startHex.coordinate,
            target: targetHex.coordinate,
            path: path || [],
            cargo: {},
            integrity: 100,
            activity: 'MOVING' as const,
            status: 'BUSY' as const,
            waitTicks: 0
        };

        if (type === 'Caravan') {
            agent = { ...base, type: 'Caravan', mission: 'IDLE' };
        } else if (type === 'Settler') {
            agent = { ...base, type: 'Settler', destinationId: targetHexId };
        } else if (type === 'Villager') {
            agent = { ...base, type: 'Villager', homeId: 'temp', mission: 'IDLE' };
        } else {
            agent = { ...base, type: 'Caravan' };
        }

        state.agents[id] = agent;
        return agent;
    },

    dispatch(state: WorldState, settlement: any, targetHexId: string, mission: 'TRADE' | 'LOGISTICS', config: GameConfig, context: any): AgentEntity | null {
        let agent = Object.values(state.agents).find(a =>
            a.type === 'Caravan' &&
            a.ownerId === settlement.ownerId &&
            a.status === 'IDLE' &&
            a.homeId === settlement.id
        ) as AgentEntity | undefined;

        if (!agent) {
            const constructionThreshold = mission === 'TRADE'
                ? (config.costs.logistics?.constructionRoiThreshold || 50)
                : (config.costs.logistics?.freightConstructionThreshold || 100);

            const value = context.value || 0;
            if (value < constructionThreshold) {
                return null;
            }

            const cost = config.costs.agents.Caravan.Timber || 50;
            if (settlement.stockpile.Timber >= cost) {
                settlement.stockpile.Timber -= cost;
                agent = this.spawn(state, settlement.hexId, targetHexId, 'Caravan', config) || undefined;
                if (agent && agent.type === 'Caravan') {
                    agent.ownerId = settlement.ownerId;
                    agent.homeId = settlement.id;
                }
            }
        } else {
            const startHex = state.map[settlement.hexId];
            const targetHex = state.map[targetHexId];
            if (startHex && targetHex) {
                const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);
                if (path) {
                    agent.path = path;
                    agent.target = targetHex.coordinate;
                    agent.activity = 'MOVING';
                    agent.status = 'BUSY';
                    agent.waitTicks = 0;
                } else {
                    return null;
                }
            }
        }

        if (agent && agent.type === 'Caravan') {
            agent.mission = mission;
            if (mission === 'TRADE') {
                agent.homeId = settlement.id;
                agent.targetSettlementId = context.targetId;
                agent.tradeState = 'OUTBOUND';
                agent.tradeResource = context.resource;
                agent.cargo.Gold = context.gold;
            } else if (mission === 'LOGISTICS') {
                agent.homeId = settlement.id;
                agent.targetSettlementId = undefined;
                agent.tradeState = 'OUTBOUND';
            }
        }

        return agent || null;
    },

    update(state: WorldState, globalConfig: GameConfig) {
        const agentsToRemove: string[] = [];

        Object.values(state.agents).forEach(agent => {
            let config = globalConfig;
            const faction = state.factions[agent.ownerId];
            if (faction && (faction as any).aiConfig) {
                config = (faction as any).aiConfig;
            }

            if (agent.type === 'Caravan' && agent.status === 'IDLE' && agent.homeId) {
                const home = state.settlements[agent.homeId];
                if (home && HexUtils.getID(agent.position) === home.hexId) {
                    if (agent.integrity < 100) {
                        const repairCost = config.costs.logistics?.caravanRepairCost || 5;
                        if (home.stockpile.Timber >= repairCost) {
                            home.stockpile.Timber -= repairCost;
                            agent.integrity = Math.min(100, agent.integrity + 20);
                        }
                    }

                    if (faction) {
                        const bestJobs = BlackboardDispatcher.getTopAvailableJobs(agent, faction, state, config, 1);
                        if (bestJobs.length > 0) {
                            const job = bestJobs[0];
                            const capacity = config.costs.trade?.capacity || 50;
                            if (BlackboardDispatcher.claimJob(faction, agent, job, capacity)) {
                                agent.jobId = job.jobId;

                                if (job.type === 'COLLECT' || job.type === 'TRANSFER') {
                                    const targetHexId = job.targetHexId || (job.sourceId ? state.settlements[job.sourceId]?.hexId : undefined);
                                    if (targetHexId) {
                                        this.dispatch(state, home, targetHexId, 'LOGISTICS', config, {});
                                    }
                                } else if (job.type === 'TRADE') {
                                    // Intelligent Trade Resolution
                                    // 1. Check for Critical Shortages (IMPORTS)
                                    const shortages = faction.blackboard?.criticalShortages || [];
                                    let handled = false;

                                    if (shortages.length > 0) {
                                        for (const res of shortages) {
                                            const route = TradeStrategy.findBestSeller(home, res, state, config);
                                            if (route) {
                                                this.dispatch(state, home, route.targetId, 'TRADE', config, route);
                                                handled = true;
                                                break;
                                            }
                                        }
                                    }

                                    // 2. Check for Surplus (EXPORTS) if no critical imports found
                                    if (!handled) {
                                        const surplusThreshold = config.industry.surplusThreshold || 100;
                                        for (const [res, amount] of Object.entries(home.stockpile)) {
                                            if ((amount as number) > surplusThreshold) {
                                                const route = TradeStrategy.findBestBuyer(home, res as ResourceType, (amount as number) - surplusThreshold, state, config);
                                                if (route) {
                                                    this.dispatch(state, home, route.targetId, 'TRADE', config, route);
                                                    handled = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    // If we dispatched, we KEEP the job (or maybe complete it? Logic says dispatch keeps it)
                                    // Actually dispatch() assigns mission. 
                                    // But if we failed to find any route, we release the job.
                                    if (!handled) {
                                        BlackboardDispatcher.releaseAssignment(faction, job.jobId, capacity);
                                        agent.jobId = undefined;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (agent.waitTicks && agent.waitTicks > 0) {
                agent.waitTicks--;
                return;
            }

            if ((agent.stuckTicks || 0) > 40) {
                this.returnHome(state, agent, config);
            }

            if (agent.path && agent.path.length > 0) {
                return;
            }

            const hexId = HexUtils.getID(agent.position);
            const settlement = Object.values(state.settlements).find(s => s.hexId === hexId);
            const loadingTime = config.costs.trade?.loadingTime || 20;

            if (agent.type === 'Caravan' && agent.mission === 'LOGISTICS') {
                if (agent.tradeState === 'OUTBOUND') {
                    if (agent.activity !== 'LOADING') {
                        agent.activity = 'LOADING';
                        agent.waitTicks = loadingTime;
                        return;
                    }

                    const hex = state.map[hexId];
                    if (hex && hex.resources) {
                        (Object.entries(hex.resources) as [keyof Resources, number][]).forEach(([res, amount]) => {
                            if (amount > 0) {
                                agent.cargo[res] = (agent.cargo[res] || 0) + amount;
                                hex.resources![res] = 0;
                            }
                        });
                    }
                    this.returnHome(state, agent, config);
                } else if (agent.tradeState === 'INBOUND') {
                    if (agent.activity !== 'UNLOADING') {
                        agent.activity = 'UNLOADING';
                        agent.waitTicks = loadingTime;
                        return;
                    }

                    const homeId = agent.homeId;
                    if (homeId) {
                        const home = state.settlements[homeId];
                        if (home) {
                            let totalDelivered = 0;
                            (Object.entries(agent.cargo) as [keyof Resources, number][]).forEach(([res, amount]) => {
                                if (amount > 0) {
                                    home.stockpile[res] += amount;
                                    agent.cargo[res] = 0;
                                    totalDelivered += amount;
                                }
                            });

                            if (agent.jobId) {
                                const f = state.factions[home.ownerId];
                                if (f) {
                                    BlackboardDispatcher.reportProgress(f, agent.jobId, totalDelivered);
                                }
                                agent.jobId = undefined;
                            }
                        }
                    }
                    agent.status = 'IDLE';
                    agent.mission = 'IDLE';
                    agent.activity = 'IDLE';
                }
                return;
            }

            if (agent.type === 'Caravan' && agent.mission === 'TRADE') {
                if (agent.tradeState === 'OUTBOUND') {
                    if (settlement && settlement.id === agent.targetSettlementId) {
                        if (agent.activity !== 'LOADING') {
                            agent.activity = 'LOADING';
                            agent.waitTicks = loadingTime;
                            return;
                        }

                        const neededRes = agent.tradeResource as keyof Resources;
                        const gold = agent.cargo.Gold || 0;
                        const buyCap = config.costs.trade?.buyCap || 50;
                        const amountToBuy = Math.min(gold, settlement.stockpile[neededRes], buyCap);

                        if (amountToBuy > 0) {
                            settlement.stockpile[neededRes] -= amountToBuy;
                            settlement.stockpile.Gold += amountToBuy;
                            agent.cargo.Gold = 0;
                            agent.cargo[neededRes] = amountToBuy;

                            // LOG TRADE STATS
                            if (faction && faction.stats) {
                                faction.stats.totalTrades++;
                                faction.stats.tradeResources[neededRes as ResourceType] = (faction.stats.tradeResources[neededRes as ResourceType] || 0) + 1;
                            }
                        }
                        this.returnHome(state, agent, config);
                    } else {
                        this.returnHome(state, agent, config);
                    }
                } else if (agent.tradeState === 'INBOUND') {
                    if (settlement && settlement.id === agent.homeId) {
                        if (agent.activity !== 'UNLOADING') {
                            agent.activity = 'UNLOADING';
                            agent.waitTicks = loadingTime;
                            return;
                        }
                        (Object.entries(agent.cargo) as [keyof Resources, number][]).forEach(([res, amount]) => {
                            if (amount > 0) {
                                settlement.stockpile[res] += amount;
                                agent.cargo[res] = 0;
                            }
                        });
                        agent.status = 'IDLE';
                        agent.mission = 'IDLE';
                        agent.activity = 'IDLE';
                    }
                }
            }

            if (agent.type === 'Settler') {
                if (!agent.path || agent.path.length === 0) {
                    const currentHexId = HexUtils.getID(agent.position);
                    if (agent.destinationId && currentHexId !== agent.destinationId) return;

                    const targetHex = state.map[currentHexId];
                    const existingSettlement = Object.values(state.settlements).find(s => s.hexId === currentHexId);
                    if (!existingSettlement && targetHex) {
                        const newId = `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        state.settlements[newId] = {
                            id: newId,
                            name: `New Settlement ${Object.keys(state.settlements).length + 1}`,
                            ownerId: agent.ownerId,
                            hexId: currentHexId,
                            population: config.ai.thresholds.newSettlementPop || 100,
                            tier: 0,
                            integrity: config.ai.thresholds.newSettlementIntegrity || 100,
                            stockpile: {
                                Food: agent.cargo.Food || 0,
                                Timber: agent.cargo.Timber || 0,
                                Stone: agent.cargo.Stone || 0,
                                Ore: agent.cargo.Ore || 0,
                                Tools: agent.cargo.Tools || 0,
                                Gold: agent.cargo.Gold || 0
                            },
                            buildings: [],
                            controlledHexIds: [],
                            jobCap: 0,
                            workingPop: 0,
                            availableVillagers: config.costs.villagers?.baseVillagers || 5,
                            unreachableHexes: {},
                            lastGrowth: state.tick,
                            popHistory: [],
                            role: 'GENERAL',
                            aiState: { surviveMode: false, savingFor: null, focusResources: [] }
                        };

                        if (state.map[currentHexId]) {
                            state.map[currentHexId].ownerId = agent.ownerId;
                        }

                        // LOG SETTLEMENT STATS
                        const faction = state.factions[agent.ownerId];
                        if (faction && faction.stats) {
                            faction.stats.settlementsFounded++;
                        }

                        Logger.getInstance().log(`[GAME] Settlement Founded at ${currentHexId}`);
                    }
                    agentsToRemove.push(agent.id);
                }
            }
        });

        agentsToRemove.forEach(id => delete state.agents[id]);
    },

    returnHome(state: WorldState, agent: AgentEntity, config?: GameConfig) {
        if (agent.type !== 'Caravan' || !agent.homeId) return;
        const home = state.settlements[agent.homeId];
        if (home) {
            const homeHex = state.map[home.hexId];
            const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config);
            if (path) {
                agent.path = path;
                agent.target = homeHex.coordinate;
                agent.tradeState = 'INBOUND';
                agent.activity = 'MOVING';
                agent.status = 'RETURNING';
                agent.waitTicks = 0;
            }
        }
    }
};
