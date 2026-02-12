import { WorldState, Resources, VillagerAgent, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';
import { Logger } from '../../utils/Logger';
import { Pathfinding } from '../Pathfinding';

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

    handleGather(state: WorldState, agent: VillagerAgent, config: GameConfig) {
        // ... existing handleGather code ...
        // Arrived at target?
        if (!agent.gatherTarget) {
            // Error state, return home
            this.returnHome(state, agent, config);
            return;
        }

        const currentHexId = HexUtils.getID(agent.position);
        const targetHexId = HexUtils.getID(agent.gatherTarget);

        if (currentHexId === targetHexId) {
            // ARRIVED -> PICK UP
            const hex = state.map[currentHexId];
            if (hex && hex.resources) {
                // Determine Capacity
                const capacity = config.costs.villagers?.capacity || 20;
                let currentLoad = Object.values(agent.cargo).reduce((a, b) => a + b, 0);
                const space = capacity - currentLoad;

                if (space > 0) {
                    // Pick up specific resource if assigned, or any?
                    // Usually Governor assigns specific resource type or we just grab all.
                    // Let's grab everything we can.

                    for (const [res, amount] of Object.entries(hex.resources)) {
                        if (amount > 0 && space > 0) {
                            const take = Math.min(amount, space);
                            agent.cargo[res as keyof Resources] = (agent.cargo[res as keyof Resources] || 0) + take;
                            hex.resources[res as keyof Resources]! -= take;

                            // Recalculate space? No, let's just do one pass or simple check
                            // Technically we should update `space` and `currentLoad` inside loop.
                            break; // Take one type per tick? Or greedy?
                            // Let's just break for now to keep simple (one type focus)
                        }
                    }
                }
            }

            // Return Home
            this.returnHome(state, agent, config);
        } else {
            // Should be moving? If path is empty but not at target, we need path.
            // But GovernorAI should have set path.
            // If we are here, we might need to repath?
            const targetHex = state.map[HexUtils.getID(agent.gatherTarget)];
            if (targetHex) {
                const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config, 'Villager');
                if (path) {
                    agent.path = path;
                    agent.target = targetHex.coordinate;
                    agent.activity = 'MOVING';
                } else {
                    // Unreachable
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
            for (const [res, amount] of Object.entries(agent.cargo)) {
                if (amount > 0) {
                    home.stockpile[res as keyof Resources] += amount;
                    agent.cargo[res as keyof Resources] = 0;
                }
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
        if (!home) return;
        try {
            // 1. Ensure resource goals exist
            if (!home.resourceGoals) {
                Logger.getInstance().log(`[VillagerSystem] Initializing resource goals for ${home.name}`);
                home.resourceGoals = { Food: 1000, Timber: 300, Stone: 200, Ore: 100, Tools: 50, Gold: 0 };
            }
        } catch (e: any) {
            Logger.getInstance().log(`[VillagerSystem] FATAL ERROR setting resourceGoals for ${home?.name || 'UNKNOWN'}: ${e.message}`);
            throw e;
        }

        // 2. Calculate Pressure Map
        const resources: (keyof Resources)[] = ['Food', 'Timber', 'Stone', 'Ore', 'Tools'];
        const pressures = resources.map(res => {
            const goal = home.resourceGoals ? (home.resourceGoals as any)[res] : 0;
            const current = (home.stockpile as any)[res] || 0;
            return {
                res,
                pressure: Math.max(0, (goal - current) / (goal || 1))
            };
        }).sort((a, b) => b.pressure - a.pressure);

        // 3. Try to find a job matching the highest pressure
        const range = config.costs.villagers?.range || 3;

        for (const p of pressures) {
            if (p.pressure <= 0) break; // Goal reached for this and subsequent (sorted)

            // GATHER Logic: Scan controlled hexes for this resource
            const targetHexId = home.controlledHexIds.find((id: string) => {
                const hex = state.map[id];
                if (!hex || hex.terrain === 'Water') return false;
                if (home.unreachableHexes?.[id] && state.tick < home.unreachableHexes[id]) return false;

                const dist = HexUtils.distance(HexUtils.createFromID(home.hexId), hex.coordinate);
                if (dist > range) return false;

                return (hex.resources?.[p.res] || 0) > 0;
            });

            if (targetHexId) {
                // Dispatch locally (System-driven spawn bypasses Governor)
                VillagerSystem.dispatchAnt(state, agent, targetHexId, 'GATHER', config);
                return;
            }
        }

        // 4. FREIGHT Logic (Surplus distribution)
        // If we reach here, no high-pressure local gathering needed or possible
        const surpluses = resources.filter(res => (home.stockpile as any)[res] > (home.resourceGoals ? (home.resourceGoals as any)[res] : 0));

        if (surpluses.length > 0) {
            const myFactionSettlements = Object.values(state.settlements).filter(s => s.ownerId === home.ownerId && s.id !== home.id);

            for (const neighbor of myFactionSettlements) {
                // Ensure neighbor has goals
                if (!neighbor.resourceGoals) continue;

                const dist = HexUtils.distance(HexUtils.createFromID(home.hexId), HexUtils.createFromID(neighbor.hexId));
                if (dist > 10) continue;

                for (const res of surpluses) {
                    const goal = neighbor.resourceGoals ? (neighbor.resourceGoals as any)[res] : 0;
                    const current = (neighbor.stockpile as any)[res] || 0;
                    const neighborPressure = (goal - current) / (goal || 1);

                    if (neighborPressure > 0.5) {
                        // Deliver surplus
                        const amount = Math.min(20, (home.stockpile as any)[res] - (home.resourceGoals ? (home.resourceGoals as any)[res] : 0));
                        if (amount > 0) {
                            VillagerSystem.dispatchAnt(state, agent, neighbor.hexId, 'INTERNAL_FREIGHT', config, { resource: res, amount });
                            return;
                        }
                    }
                }
            }
        }
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
        }
    }
};
