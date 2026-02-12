import { WorldState } from '../../types/WorldTypes.ts';
import { HexUtils } from '../../utils/HexUtils.ts';
import { GameConfig } from '../../types/GameConfig.ts';

export const MovementSystem = {
    update(state: WorldState, config: GameConfig) {
        Object.values(state.agents).forEach(agent => {
            if (!agent.path || agent.path.length === 0) return;

            // Handle Waiting (e.g. Loading/Unloading)
            if (agent.waitTicks && agent.waitTicks > 0) {
                // Wait ticks are handled in CaravanSystem for trade logic. 
                // But if we have a generic wait, we should respect it here too.
                // However, CaravanSystem updates first and decrements it. 
                // Let's just check if it's > 0 to block movement.
                return;
            }

            const nextStep = agent.path[0];
            const cellId = HexUtils.getID(nextStep);
            const cell = state.map[cellId];

            if (!cell) {
                agent.path = []; // Cancel path if invalid
                return;
            }

            // Calculate Move Cost
            // Default to 1 if not in config
            const costs = config.costs.terrain || { Plains: 1, Forest: 2, Hills: 3, Mountains: 6, Water: 1 };
            const moveCost = costs[cell.terrain] || 1;

            // Calculate Move Speed (Points per tick)
            const speed = config.costs.movement || 1.0;

            // Initialize movement progress if missing
            if (agent.movementProgress === undefined) agent.movementProgress = 0;

            // Add progress
            agent.movementProgress += speed;

            // Check if enough progress to move
            if (agent.movementProgress >= moveCost) {
                // Move
                agent.position = nextStep;
                agent.path.shift(); // Remove visited step

                // Integrity Drain (Service Life)
                if (agent.type === 'Caravan') {
                    const loss = config.costs.logistics?.caravanIntegrityLossPerHex || 0.5;
                    agent.integrity = Math.max(0, agent.integrity - loss);
                }

                // Deduct cost (keep remainder for smooth movement)
                agent.movementProgress -= moveCost;

                // Cap remainder to avoid super-speed bursts after long waits?
                // For now, let's just keep it simple.

                // Check if arrived
                if (agent.path.length === 0 && agent.target) {
                    agent.target = null;
                    agent.movementProgress = 0; // Reset on arrival
                }
            }
        });
    }
};
