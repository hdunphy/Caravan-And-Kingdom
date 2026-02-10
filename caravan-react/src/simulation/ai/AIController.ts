import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { GoalEvaluator } from './GoalEvaluator';
import { SovereignAI } from './SovereignAI';
import { GovernorAI } from './GovernorAI';

export class AIController {
    private lastUpdateTick: number = 0;

    constructor() { }

    update(state: WorldState, config: GameConfig) {
        // Throttle AI updates
        const interval = config.ai ? config.ai.checkInterval : 10;
        if (state.tick - this.lastUpdateTick < interval) return;
        this.lastUpdateTick = state.tick;

        // Iterate over factions
        Object.values(state.factions).forEach(faction => {
            // Update Goals first (Governor Logic)
            Object.values(state.settlements).filter(s => s.ownerId === faction.id).forEach(s => {
                s.currentGoal = GoalEvaluator.evaluate(state, s, config);
            });

            // 1. Sovereign AI (Grand Strategy)
            SovereignAI.update(state, faction, config);

            // 2. Governor AI (Settlement Management)
            GovernorAI.update(state, faction, config);
        });
    }
}
