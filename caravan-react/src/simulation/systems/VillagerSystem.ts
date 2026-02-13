import { WorldState, Resources, VillagerAgent, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';
import { Logger } from '../../utils/Logger';
import { Pathfinding } from '../Pathfinding';
import { BlackboardDispatcher } from '../ai/BlackboardDispatcher';

export const VillagerSystem = {
    update(state: WorldState, config: GameConfig) {
        const agentsToRemove: string[] = [];
        const agents = Object.values(state.agents).filter(a => a.type === 'Villager') as VillagerAgent[];

        // 0. Spawn Idle Villagers from pool (availableVillagers)
        Object.values(state.settlements).forEach(settlement => {
            while (settlement.availableVillagers > 0) {
                const agent = VillagerSystem.spawnVillager(state, settlement.id, settlement.hexId, config, 'IDLE');
                if (!agent) break; // Should not happen for home hex
                // Since this happens during update, we should probably add it to the 'agents' array to be processed this tick
                // Adding to local 'agents' array for immediate dispatch in the current tick
                agents.push(agent);
            }
        });

        agents.forEach(agent => {
            // Validate Home
            if (!agent.homeId || !state.settlements[agent.homeId]) {
                agentsToRemove.push(agent.id);
                return;
            }

            const home = state.settlements[agent.homeId];

            // 1. Handle Movement / Pathfinding
            if (agent.path && agent.path.length > 0) {
                // Stuck Detection Recovery
                if ((agent.stuckTicks || 0) > 20) {
                    Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} STUCK for ${agent.stuckTicks} ticks. Returning home.`);
                    this.returnHome(state, agent, config);
                }
                return;
            }

            // 2. State Machine
            switch (agent.status) {
                case 'IDLE':
                    // Reactive Ant Logic: Autonomous Dispatch
                    if (HexUtils.getID(agent.position) === home.hexId) {
                        VillagerSystem.manageIdleAnt(state, agent, home, config);
                    } else {
                        VillagerSystem.returnHome(state, agent, config);
                    }
                    break;

                case 'BUSY':
                    if (agent.mission === 'INTERNAL_FREIGHT') {
                        this.handleFreight(state, agent, config);
                    } else if (agent.mission === 'BUILD') {
                        this.handleBuild(state, agent, config);
                    } else {
                        // usually means OUTBOUND to GATHER
                        this.handleGather(state, agent, config);
                    }
                    break;

                case 'RETURNING':
                    this.handleReturn(state, agent, home);
                    break;
            }
        });

        agentsToRemove.forEach(id => delete state.agents[id]);
    },

    handleFreight(state: WorldState, agent: VillagerAgent, config: GameConfig) {
        if (!agent.gatherTarget) {
            this.returnHome(state, agent, config);
            return;
        }

        const currentHexId = HexUtils.getID(agent.position);
        const targetHexId = HexUtils.getID(agent.gatherTarget);

        if (currentHexId === targetHexId) {
            // Arrived at Target Settlement -> DEPOSIT payload
            const targetSettlement = Object.values(state.settlements).find(s => s.hexId === targetHexId);

            if (targetSettlement && agent.cargo) {
                for (const [res, amount] of Object.entries(agent.cargo)) {
                    if (amount > 0) {
                        targetSettlement.stockpile[res as keyof Resources] += amount;
                        agent.cargo[res as keyof Resources] = 0;
                        // console.log(`[Logistics] Villager delivered ${amount} ${res} to ${targetSettlement.name}`);
                    }
                }
            }

            // Return Home
            this.returnHome(state, agent, config);
        } else {
            // Move towards target
            const targetHex = state.map[targetHexId];
            if (!agent.path || agent.path.length === 0) {
                // Logger.getInstance().log(`[VillagerSystem] Dispatching ${agent.id} to ${targetHexId} for ${mission}`);
                const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config, 'Villager');
                if (path) {
                    agent.path = path;
                    agent.target = targetHex.coordinate;
                    agent.activity = 'MOVING';
                } else {
                    Logger.getInstance().log(`[VillagerSystem] Failed to find path for ${agent.id} to ${targetHexId}`);
                    this.returnHome(state, agent, config);
                }
            }
        }
    },

    handleGather(state: WorldState, agent: VillagerAgent, config: GameConfig) {
        // Arrived at target?
        if (!agent.gatherTarget) {
            Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} has no gatherTarget`);
            this.returnHome(state, agent, config);
            return;
        }

        const currentHexId = HexUtils.getID(agent.position);
        const targetHexId = HexUtils.getID(agent.gatherTarget);

        if (currentHexId === targetHexId) {
            // ARRIVED -> PICK UP
            const hex = state.map[currentHexId];
            if (hex && hex.resources) {
                const capacity = config.costs.villagers?.capacity || 20;
                let currentLoad = Object.values(agent.cargo).reduce((a, b) => a + b, 0);
                const space = capacity - currentLoad;

                if (space > 0) {
                    let gathered = false;
                    for (const [res, amount] of Object.entries(hex.resources)) {
                        if (amount > 0 && space > 0) {
                            const take = Math.min(amount, space);
                            agent.cargo[res as keyof Resources] = (agent.cargo[res as keyof Resources] || 0) + take;
                            hex.resources[res as keyof Resources]! -= take;
                            Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} gathered ${take} ${res}`);
                            gathered = true;
                            break;
                        }
                    }
                    if (!gathered) {
                        Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} arrived but found no resources at ${currentHexId}`);
                    }
                } else {
                    Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} arrived but full`);
                }
            } else {
                Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} arrived at ${currentHexId} but no hex/resources`);
            }

            // Return Home
            this.returnHome(state, agent, config);
        } else {
            // Should be moving?
            Logger.getInstance().log(`[VillagerSystem] Agent ${agent.id} is BUSY/GATHER but not at target (Current: ${currentHexId}, Target: ${targetHexId})`);
            const targetHex = state.map[HexUtils.getID(agent.gatherTarget)];
            if (targetHex) {
                // Repath logic
                const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config, 'Villager');
                if (path) {
                    agent.path = path;
                    agent.target = targetHex.coordinate;
                    agent.activity = 'MOVING';
                } else {
                    this.returnHome(state, agent, config);
                }
            }
        }
    },

    handleReturn(state: WorldState, agent: VillagerAgent, home: any) {
        // ... existing handleReturn code ...
        const currentHexId = HexUtils.getID(agent.position);

        if (currentHexId === home.hexId) {
            // ARRIVED HOME -> DEPOSIT
            let totalGathered = 0;
            for (const [res, amount] of Object.entries(agent.cargo)) {
                if (amount > 0) {
                    home.stockpile[res as keyof Resources] += amount;
                    agent.cargo[res as keyof Resources] = 0;
                    totalGathered += amount as number;
                }
            }

            // MILESTONE 4: Report Progress
            if (agent.jobId) {
                const faction = state.factions[home.ownerId];
                if (faction) {
                    BlackboardDispatcher.reportProgress(faction, agent.jobId, totalGathered);
                }
                agent.jobId = undefined; // Clear Job
            }

            // Become Available Again
            agent.status = 'IDLE';
            agent.mission = 'IDLE';
            agent.activity = 'IDLE';
            agent.gatherTarget = undefined;

            home.availableVillagers++; // Return to pool
            delete state.agents[agent.id]; // Despawn
        } else {
            // ensure moving
            // (Logic handled by MovementSystem)
        }
    },

    handleBuild(state: WorldState, agent: VillagerAgent, config: GameConfig) {
        if (!agent.gatherTarget) {
            this.returnHome(state, agent, config);
            return;
        }

        const currentHexId = HexUtils.getID(agent.position);
        const targetHexId = HexUtils.getID(agent.gatherTarget);

        if (currentHexId === targetHexId) {
            // ARRIVED AT CONSTRUCTION SITE
            // Perform Build Work
            // For now, simpler "Touch and Go" work
            const workAmount = 10; // Build power?

            // Report Progress immediately since we are at the site
            if (agent.jobId && agent.homeId) {
                const home = state.settlements[agent.homeId];
                if (home) {
                    const faction = state.factions[home.ownerId];
                    if (faction) {
                        BlackboardDispatcher.reportProgress(faction, agent.jobId, workAmount);
                    }
                }
            }

            // Return Home (End of Shift)
            // Ideally they stay if job not done, but for simple "Ant" logic, they return.
            this.returnHome(state, agent, config);
        } else {
            // Move towards target
            const targetHex = state.map[targetHexId];
            if (targetHex) {
                if (!agent.path || agent.path.length === 0) {
                    const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config, 'Villager');
                    if (path) {
                        agent.path = path;
                        agent.target = targetHex.coordinate;
                        agent.activity = 'MOVING';
                    } else {
                        this.returnHome(state, agent, config);
                    }
                }
            }
        }
    },

    returnHome(state: WorldState, agent: VillagerAgent, config: GameConfig) {
        if (!agent.homeId) return;
        const home = state.settlements[agent.homeId];
        if (!home) return;

        const homeHex = state.map[home.hexId];
        const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config, 'Villager');

        if (path) {
            agent.path = path;
            agent.target = homeHex.coordinate;
            agent.status = 'RETURNING';
            agent.activity = 'MOVING';
        } else {
            // Teleport if stuck? Or die?
            // Die to free up slot
            delete state.agents[agent.id];
            home.availableVillagers++;
        }
    },

    // Called by GovernorAI or spawn loop
    spawnVillager(state: WorldState, settlementId: string, targetHexId: string, config: GameConfig, mission: 'GATHER' | 'INTERNAL_FREIGHT' | 'IDLE' = 'GATHER', payload?: any): VillagerAgent | null {
        const settlement = state.settlements[settlementId];
        if (!settlement) {
            Logger.getInstance().log(`[VillagerSystem] Fail: Settlement ${settlementId} not found`);
            return null;
        }
        if (settlement.availableVillagers <= 0) {
            Logger.getInstance().log(`[VillagerSystem] Fail: No available villagers in ${settlement.name}`);
            return null;
        }

        const startHex = state.map[settlement.hexId];
        const targetHex = state.map[targetHexId];
        if (!startHex || !targetHex) {
            Logger.getInstance().log(`[VillagerSystem] Fail: Hex search failed for ${settlement.hexId} or ${targetHexId}`);
            return null;
        }

        let path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config, 'Villager');

        // Allow spawning on same hex (Gathering at home)
        if (targetHexId === settlement.hexId) {
            path = [];
        } else if (!path || path.length === 0) {
            // BLACKLIST: If No Path, mark as unreachable for 100 ticks
            const expiry = state.tick + 100;
            if (!settlement.unreachableHexes) settlement.unreachableHexes = {};
            settlement.unreachableHexes[targetHexId] = expiry;
            Logger.getInstance().log(`[VillagerSystem] Blacklisting ${targetHexId} for ${settlement.name} until ${expiry} (Pathfinding Failed)`);
            return null;
        }

        // Decrement pool
        settlement.availableVillagers--;

        // Prepare Cargo for Freight
        const cargo: any = {};
        if (mission === 'INTERNAL_FREIGHT' && payload) {
            // Deduct from settlement stockpile
            const res = payload.resource as keyof Resources;
            const amount = payload.amount;
            if (settlement.stockpile[res] >= amount) {
                settlement.stockpile[res] -= amount;
                cargo[res] = amount;
            } else {
                // Abort if not enough resources
                settlement.availableVillagers++;
                return null;
            }
        }

        const id = `villager_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const agent: VillagerAgent = {
            id,
            type: 'Villager',
            ownerId: settlement.ownerId,
            homeId: settlement.id,
            position: startHex.coordinate,
            target: targetHex.coordinate,
            path: path,
            cargo: cargo,
            integrity: 100,
            status: mission === 'IDLE' ? 'IDLE' : 'BUSY',
            activity: mission === 'IDLE' ? 'IDLE' : 'MOVING',
            mission: mission,
            gatherTarget: mission === 'IDLE' ? undefined : targetHex.coordinate
        };

        state.agents[id] = agent;
        return agent;
    },

    manageIdleAnt(state: WorldState, agent: VillagerAgent, home: Settlement, config: GameConfig) {
        // MILESTONE 4: Blackboard Dispatcher Integration
        const faction = state.factions[home.ownerId];
        if (!faction) return;

        // 1. Poll for Jobs
        const bestJobs = BlackboardDispatcher.getTopAvailableJobs(agent, faction, state, config, 1);

        if (bestJobs.length > 0) {
            const bestJob = bestJobs[0];

            // 2. Claim Job
            // Villager Capacity default 20
            const capacity = config.costs.villagers?.capacity || 20;
            const success = BlackboardDispatcher.claimJob(faction, agent, bestJob, capacity);

            if (success) {
                agent.jobId = bestJob.jobId;

                // 3. Execute Job (Setup Mission)
                if (bestJob.type === 'COLLECT') {
                    // GATHER
                    // Use targetHexId if present, else find source
                    let targetHexId = bestJob.targetHexId;

                    // Fallback: If no targetHex but specific resource, find local source
                    if (!targetHexId && bestJob.resource) {
                        const range = config.costs.villagers?.range || 3;
                        targetHexId = home.controlledHexIds.find((id: string) => {
                            const hex = state.map[id];
                            if (!hex || hex.terrain === 'Water') return false;
                            const dist = HexUtils.distance(HexUtils.createFromID(home.hexId), hex.coordinate);
                            if (dist > range) return false;
                            return (hex.resources?.[bestJob.resource!] || 0) > 0;
                        });
                    }

                    if (targetHexId) {
                        VillagerSystem.dispatchAnt(state, agent, targetHexId, 'GATHER', config);
                        // Agent mission is set in dispatchAnt. 
                        // We might want to store 'job' context on agent if needed later.
                    } else {
                        // Job claimed but no valid target found? Release.
                        BlackboardDispatcher.releaseAssignment(faction, bestJob.jobId, capacity);
                        agent.jobId = undefined;
                    }

                } else if (bestJob.type === 'BUILD') {
                    // Go to construction site
                    if (bestJob.targetHexId) {
                        VillagerSystem.dispatchAnt(state, agent, bestJob.targetHexId, 'BUILD', config);
                    }
                }

                return;
            }
        }

        // Fallback: Legacy Logic or just idle?
        // If no jobs, maybe do local gathering if desperate? 
        // For now, if no jobs, they stay IDLE.
    },

    dispatchAnt(state: WorldState, agent: VillagerAgent, targetHexId: string, mission: any, config: GameConfig, payload?: any) {
        const targetHex = state.map[targetHexId];
        if (!targetHex) return;

        const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config, 'Villager');
        if (path) {
            agent.path = path;
            agent.target = targetHex.coordinate;
            agent.status = 'BUSY';
            agent.activity = 'MOVING';
            agent.mission = mission;
            agent.gatherTarget = targetHex.coordinate;

            if (mission === 'INTERNAL_FREIGHT' && payload) {
                const res = payload.resource as keyof Resources;
                const amt = payload.amount;
                if (state.settlements[agent.homeId].stockpile[res] >= amt) {
                    state.settlements[agent.homeId].stockpile[res] -= amt;
                    agent.cargo[res] = amt;
                }
            }
        } else {
            // Mark unreachable
            const home = state.settlements[agent.homeId];
            if (home) {
                if (!home.unreachableHexes) home.unreachableHexes = {};
                home.unreachableHexes[targetHexId] = state.tick + 100;
            }

            // Release Job if applicable
            if (agent.jobId) {
                const faction = state.factions[agent.ownerId];
                if (faction) {
                    const capacity = config.costs.villagers?.capacity || 20;
                    BlackboardDispatcher.releaseAssignment(faction, agent.jobId, capacity);
                    Logger.getInstance().log(`[VillagerSystem] Released job ${agent.jobId} for agent ${agent.id} due to pathfinding failure.`);
                }
                agent.jobId = undefined;
            }
        }
    }
};
