import { WorldState, Resources, AgentEntity, AgentType } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { HexUtils } from '../../utils/HexUtils.ts';
import { Pathfinding } from '../Pathfinding.ts';
import { Logger } from '../../utils/Logger.ts';

export const CaravanSystem = {
    // Determine spawn location (Settlement or from IDLE pool)
    spawn(state: WorldState, startHexId: string, targetHexId: string, type: AgentType = 'Caravan', config?: GameConfig): AgentEntity | null {
        const startHex = state.map[startHexId];
        const targetHex = state.map[targetHexId];

        if (!startHex || !targetHex) return null;

        const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config, type);
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
            // Villagers require homeId, which should be passed. For now, we might need to adjust spawn signature
            // or handle it after spawn.
            // Hack: We will set homeId immediately after spawn in the caller.
            agent = { ...base, type: 'Villager', homeId: 'temp', mission: 'IDLE' };
        } else {
            // Fallback for Scout/Army if implemented later
            agent = { ...base, type: 'Caravan' }; // Default to caravan for now to satisfy type
        }

        state.agents[id] = agent;
        return agent;
    },

    processTrade(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(source => {
            if (source.stockpile.Gold < 1) return;

            // 1. Identify Deficit
            const goal = source.currentGoal || 'TOOLS';
            let deficits: string[] = [];

            if (goal === 'UPGRADE') {
                const nextTier = source.tier + 1;
                const cost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
                if (source.stockpile.Timber < cost.costTimber) deficits.push('Timber');
                if (source.stockpile.Stone < cost.costStone) deficits.push('Stone');
                if ('costOre' in cost && source.stockpile.Ore < (cost as any).costOre) deficits.push('Ore');
            } else if (goal === 'EXPAND') {
                const cost = config.costs.settlement;
                if (source.stockpile.Food < (cost.Food || 500)) deficits.push('Food');
                if (source.stockpile.Timber < (cost.Timber || 200)) deficits.push('Timber');
            } else if (goal === 'SURVIVE') {
                const consumption = Math.max(5, source.population * config.costs.baseConsume);
                if (source.stockpile.Food < consumption * 50) deficits.push('Food');
            } else if (goal === 'TOOLS') {
                if (source.stockpile.Timber < 100) deficits.push('Timber');
                if (source.stockpile.Ore < 50) deficits.push('Ore');
            }

            if (deficits.length === 0) return;
            const neededRes = deficits[0] as keyof Resources;

            // 2. Find Neighbor with Surplus
            const potentialTargets = Object.values(state.settlements).filter(t => t.id !== source.id);
            const target = potentialTargets.find(t => {
                const tCons = Math.max(5, t.population * config.costs.baseConsume);
                const surplusThreshold = neededRes === 'Food' ? tCons * 20 : 100;
                return t.stockpile[neededRes] > surplusThreshold;
            });

            if (target) {
                // Check for existing active trade route for this resource/target
                const existingRoute = Object.values(state.agents).find(a =>
                    a.type === 'Caravan' &&
                    a.ownerId === source.ownerId &&
                    a.mission === 'TRADE' &&
                    a.targetSettlementId === target.id &&
                    a.tradeResource === neededRes
                );

                if (existingRoute) return;

                // 3. ROI Check
                const goldPerRes = config.costs.trade?.simulatedGoldPerResource || 1;
                const capacity = config.costs.trade?.capacity || 50;
                const afford = Math.floor(source.stockpile.Gold / goldPerRes);
                const amount = Math.min(capacity, afford, target.stockpile[neededRes]);
                const tradeValue = amount * goldPerRes;

                const roiThreshold = config.costs.logistics?.tradeRoiThreshold || 20;

                if (tradeValue >= roiThreshold) {
                    this.dispatch(state, source, target.hexId, 'TRADE', config, {
                        targetId: target.id,
                        resource: neededRes,
                        gold: amount * goldPerRes,
                        value: amount * goldPerRes
                    });
                }
            }
        });
    },

    forceTrade(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(source => {
            const resources = ['Food', 'Timber', 'Stone', 'Ore'] as const;
            const neededRes = resources[Math.floor(Math.random() * resources.length)];
            const potentialTargets = Object.values(state.settlements).filter(t => t.id !== source.id);
            if (potentialTargets.length > 0) {
                const target = potentialTargets[0];
                this.dispatch(state, source, target.hexId, 'TRADE', config, {
                    targetId: target.id,
                    resource: neededRes,
                    gold: config.costs.trade.forceTradeGold || 50
                });
            }
        });
    },

    dispatch(state: WorldState, settlement: any, targetHexId: string, mission: 'TRADE' | 'LOGISTICS', config: GameConfig, context: any): AgentEntity | null {
        // 1. Check for IDLE caravan at settlement
        // 1. Check for IDLE caravan belonging to this settlement
        // Loose check: Any IDLE caravan with correct homeId, regardless of exact position
        let agent = Object.values(state.agents).find(a =>
            a.type === 'Caravan' &&
            a.ownerId === settlement.ownerId &&
            a.status === 'IDLE' &&
            a.homeId === settlement.id
        ) as AgentEntity | undefined;

        // 2. If no IDLE, check cost and spawn new
        if (!agent) {
            // STRICT CHECK: Is it worth building a NEW caravan?
            const constructionThreshold = mission === 'TRADE'
                ? (config.costs.logistics?.constructionRoiThreshold || 50)
                : (config.costs.logistics?.freightConstructionThreshold || 100);

            const value = context.value || 0;
            if (value < constructionThreshold) {
                return null; // Not worth building a new one
            }

            const cost = config.costs.trade?.caravanTimberCost || 50;
            if (settlement.stockpile.Timber >= cost) {
                // Buy new
                settlement.stockpile.Timber -= cost;
                agent = this.spawn(state, settlement.hexId, targetHexId, 'Caravan', config) || undefined;
                if (agent && agent.type === 'Caravan') {
                    agent.ownerId = settlement.ownerId;
                    agent.homeId = settlement.id;
                }
            }
        } else {
            // Reuse Agent
            const startHex = state.map[settlement.hexId];
            const targetHex = state.map[targetHexId];
            if (startHex && targetHex) {
                const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config, 'Caravan');
                if (path) {
                    agent.path = path;
                    agent.target = targetHex.coordinate;
                    agent.activity = 'MOVING';
                    agent.status = 'BUSY';
                    agent.waitTicks = 0;
                } else {
                    return null; // No path
                }
            }
        }

        if (agent && agent.type === 'Caravan') {
            agent.mission = mission;
            // Setup specific mission data
            if (mission === 'TRADE') {
                agent.homeId = settlement.id;
                agent.targetSettlementId = context.targetId;
                agent.tradeState = 'OUTBOUND';
                agent.tradeResource = context.resource;
                agent.cargo.Gold = context.gold;
            } else if (mission === 'LOGISTICS') {
                agent.homeId = settlement.id;
                agent.targetSettlementId = undefined; // No target settlement, just hex
                // We might need a "Logistics State" (Outbound -> Collect -> Return)
                agent.tradeState = 'OUTBOUND';
            }
        }

        return agent || null;
    },

    update(state: WorldState, config: GameConfig) {
        const agentsToRemove: string[] = [];

        Object.values(state.agents).forEach(agent => {
            // Maintenance for IDLE Agents
            if (agent.type === 'Caravan' && agent.status === 'IDLE' && agent.homeId) {
                const home = state.settlements[agent.homeId];
                if (home && HexUtils.getID(agent.position) === home.hexId) {
                    if (agent.integrity < 100) {
                        const repairCost = config.costs.logistics?.caravanRepairCost || 5;
                        if (home.stockpile.Timber >= repairCost) {
                            home.stockpile.Timber -= repairCost;
                            agent.integrity = Math.min(100, agent.integrity + 20); // Repair chunk
                        }
                    }
                }
            }

            // Handle Waiting
            if (agent.waitTicks && agent.waitTicks > 0) {
                agent.waitTicks--;
                return;
            }

            // Stuck Detection Recovery
            if ((agent.stuckTicks || 0) > 40) {
                Logger.getInstance().log(`[CaravanSystem] Agent ${agent.id} STUCK. Returning home.`);
                this.returnHome(state, agent, config);
            }

            // Path Following
            if (agent.path && agent.path.length > 0) {
                return; // MovementSystem handles position updates
            }

            // Arrival Logic (Path check is done in MovementSystem, here we handle logic when path is empty)
            // Check if arrived (no path left)
            // MovementSystem clears path and nulls target on arrival.
            // So if path is empty, we are at destination (or started there).

            // Logic Trigger
            const hexId = HexUtils.getID(agent.position);
            const settlement = Object.values(state.settlements).find(s => s.hexId === hexId);
            const loadingTime = config.costs.trade?.loadingTime || 20;

            // --- LOGISTICS MISSION ---
            if (agent.type === 'Caravan' && agent.mission === 'LOGISTICS') {
                if (agent.tradeState === 'OUTBOUND') {
                    // Arrived at Extraction Hex
                    // LOAD RESOURCES
                    if (agent.activity !== 'LOADING') {
                        agent.activity = 'LOADING';
                        agent.waitTicks = loadingTime;
                        return;
                    }

                    // Execute Load
                    const hex = state.map[hexId];
                    if (hex && hex.resources) {
                        // Take all resources
                        (Object.entries(hex.resources) as [keyof Resources, number][]).forEach(([res, amount]) => {
                            if (amount > 0) {
                                agent.cargo[res] = (agent.cargo[res] || 0) + amount;
                                hex.resources![res] = 0;
                            }
                        });
                    }

                    // Return Home
                    this.returnHome(state, agent, config);
                } else if (agent.tradeState === 'INBOUND') {
                    // Returned Base
                    if (agent.activity !== 'UNLOADING') {
                        agent.activity = 'UNLOADING';
                        agent.waitTicks = loadingTime;
                        return;
                    }

                    // Unload
                    const homeId = agent.homeId;
                    if (homeId) {
                        const home = state.settlements[homeId];
                        if (home) {
                            const haul: string[] = [];
                            (Object.entries(agent.cargo) as [keyof Resources, number][]).forEach(([res, amount]) => {
                                if (amount > 0) {
                                    home.stockpile[res] += amount;
                                    haul.push(`${amount} ${res}`);
                                    agent.cargo[res] = 0;
                                }
                            });
                            if (haul.length > 0) {
                                Logger.getInstance().log(`[Logistics] Caravan returned to ${home.name} with: ${haul.join(', ')}`);
                            }
                        }
                    }

                    // Set IDLE
                    agent.status = 'IDLE';
                    agent.mission = 'IDLE';
                    agent.activity = 'IDLE';
                }
                return;
            }

            // --- TRADE MISSION ---
            if (agent.type === 'Caravan' && agent.mission === 'TRADE') {
                if (agent.tradeState === 'OUTBOUND') {
                    if (settlement && settlement.id === agent.targetSettlementId) {
                        if (agent.activity !== 'LOADING') {
                            agent.activity = 'LOADING';
                            agent.waitTicks = loadingTime;
                            return;
                        }

                        // Trade Execution
                        const neededRes = agent.tradeResource as keyof Resources;
                        const gold = agent.cargo.Gold || 0;
                        const buyCap = config.costs.trade?.buyCap || 50;
                        const amountToBuy = Math.min(gold, settlement.stockpile[neededRes], buyCap);

                        if (amountToBuy > 0) {
                            settlement.stockpile[neededRes] -= amountToBuy;
                            settlement.stockpile.Gold += amountToBuy;
                            agent.cargo.Gold = 0;
                            agent.cargo[neededRes] = amountToBuy;
                        }
                        this.returnHome(state, agent, config);
                    } else {
                        // Target invalid?
                        this.returnHome(state, agent, config);
                    }
                } else if (agent.tradeState === 'INBOUND') {
                    if (settlement && settlement.id === agent.homeId) {
                        if (agent.activity !== 'UNLOADING') {
                            agent.activity = 'UNLOADING';
                            agent.waitTicks = loadingTime;
                            return;
                        }
                        // Unload
                        const haul: string[] = [];
                        (Object.entries(agent.cargo) as [keyof Resources, number][]).forEach(([res, amount]) => {
                            if (amount > 0) {
                                settlement.stockpile[res] += amount;
                                haul.push(`${amount} ${res}`);
                                agent.cargo[res] = 0;
                            }
                        });
                        if (haul.length > 0) {
                            Logger.getInstance().log(`[Trade] Caravan returned to ${settlement.name} with: ${haul.join(', ')}`);
                        }

                        // Set IDLE
                        agent.status = 'IDLE';
                        agent.mission = 'IDLE';
                        agent.activity = 'IDLE';
                    }
                }
            }

            // --- SETTLER MISSION ---
            if (agent.type === 'Settler') {
                if (!agent.path || agent.path.length === 0) {
                    // Arrival at target
                    const currentHexId = HexUtils.getID(agent.position);

                    // CRITICAL: Verify we are actually at the destination
                    if (agent.destinationId && currentHexId !== agent.destinationId) {
                        // Not at destination yet, MovementSystem will handle it
                        return;
                    }

                    const targetHex = state.map[currentHexId];
                    const existingSettlement = Object.values(state.settlements).find(s => s.hexId === HexUtils.getID(agent.position));
                    if (!existingSettlement && targetHex) {
                        // Create New Settlement
                        const newId = `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        state.settlements[newId] = {
                            id: newId,
                            name: `New Settlement ${Object.keys(state.settlements).length + 1}`,
                            ownerId: agent.ownerId,
                            hexId: HexUtils.getID(agent.position),
                            population: config.ai.thresholds.newSettlementPop || 100, // Initial Pop
                            tier: 0,
                            integrity: config.ai.thresholds.newSettlementIntegrity || 100, // Initial Integrity
                            stockpile: {
                                Food: agent.cargo.Food || 0,
                                Timber: agent.cargo.Timber || 0,
                                Stone: agent.cargo.Stone || 0,
                                Ore: agent.cargo.Ore || 0,
                                Tools: agent.cargo.Tools || 0,
                                Gold: agent.cargo.Gold || 0
                            }, // Unload Cargo
                            buildings: [],
                            // Grant Range 1 Territory immediately so Villagers have work
                            controlledHexIds: [
                                HexUtils.getID(agent.position),
                                ...HexUtils.getNeighbors(agent.position).map(h => HexUtils.getID(h))
                            ].filter(id => state.map[id]), // valid hexes only
                            jobCap: 0,
                            workingPop: 0,
                            availableVillagers: 1, // Settler converts to Villager

                            // Initialize with default values
                            currentGoal: 'SURVIVE',
                            lastGrowth: 0,
                            popHistory: [],
                            role: 'GENERAL'
                        };

                        // Set Map Owner
                        if (state.map[HexUtils.getID(agent.position)]) {
                            state.map[HexUtils.getID(agent.position)].ownerId = agent.ownerId;
                        }
                        Logger.getInstance().log(`[GAME] Settlement Founded at ${HexUtils.getID(agent.position)}`);
                    }

                    // Consume Settler
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
            const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config, 'Caravan');
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
