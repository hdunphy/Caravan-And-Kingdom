import { WorldState, Resources, VillagerAgent } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { HexUtils } from '../../utils/HexUtils.ts';
import { Pathfinding } from '../Pathfinding.ts';

export const VillagerSystem = {
    update(state: WorldState, config: GameConfig) {
        const agentsToRemove: string[] = [];
        const agents = Object.values(state.agents).filter(a => a.type === 'Villager') as VillagerAgent[];

        agents.forEach(agent => {
            // Validate Home
            if (!agent.homeId || !state.settlements[agent.homeId]) {
                agentsToRemove.push(agent.id);
                return;
            }

            const home = state.settlements[agent.homeId];

            // 1. Handle Movement / Pathfinding
            if (agent.path && agent.path.length > 0) {
                // Movement is handled by MovementSystem. 
                // We just wait for arrival (path empty).
                return;
            }

            // 2. State Machine
            switch (agent.status) {
                case 'IDLE':
                    // Handled by GovernorAI (Dispatch)
                    // If IDLE and not at home, return home?
                    if (HexUtils.getID(agent.position) !== home.hexId) {
                        this.returnHome(state, agent, config);
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
                    const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config);
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
                const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config);
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
        const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config);

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

    // Called by GovernorAI
    spawnVillager(state: WorldState, settlementId: string, targetHexId: string, config: GameConfig, mission: 'GATHER' | 'INTERNAL_FREIGHT' = 'GATHER', payload?: any): VillagerAgent | null {
        const settlement = state.settlements[settlementId];
        if (!settlement || settlement.availableVillagers <= 0) return null;

        const startHex = state.map[settlement.hexId];
        const targetHex = state.map[targetHexId];
        if (!startHex || !targetHex) return null;

        let path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);

        // Allow spawning on same hex
        if (targetHexId === settlement.hexId) {
            path = [startHex.coordinate];
        }

        if (!path || path.length === 0) return null;

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
            status: 'BUSY',
            activity: 'MOVING',
            mission: mission,
            gatherTarget: targetHex.coordinate
        };

        state.agents[id] = agent;
        return agent;
    }
};
