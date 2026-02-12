import { WorldState, Settlement, GoalType } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { MapGenerator } from '../MapGenerator.ts';

export class GoalEvaluator {
    static evaluate(state: WorldState, settlement: Settlement, config: GameConfig): GoalType {
        // Dynamic Consumption Rate
        const consumption = settlement.population * config.costs.baseConsume;

        // Hysteresis for Survival
        // Enter SURVIVE if < 10 ticks of food
        const surviveTicks = config.ai.thresholds.surviveTicks || 20;
        const criticalThreshold = Math.max(config.ai.thresholds.surviveFood, consumption * surviveTicks);
        // Exit SURVIVE only if > 30 ticks of food (buffer)
        const safeThreshold = criticalThreshold * 2.0;

        if (settlement.currentGoal === 'SURVIVE') {
            if (settlement.stockpile.Food < safeThreshold) return 'SURVIVE'; // Stay in panic
        } else {
            if (settlement.stockpile.Food < criticalThreshold) return 'SURVIVE'; // Enter panic
        }

        // THRIFTY: If between critical and safe
        if (settlement.stockpile.Food < safeThreshold) {
            return 'THRIFTY';
        }

        // 2. UPGRADE: If not max tier
        if (settlement.tier < 2) {
            // Check limits
            let cap = config.upgrades.villageToTown.popCap || 200;
            if (settlement.tier === 1) cap = config.upgrades.townToCity.popCap || 500;

            // If we are at 80% capacity, FORCE upgrade priority
            const upgradePopRatio = config.ai.thresholds.upgradePopRatio || 0.8;
            if (settlement.population > cap * upgradePopRatio) return 'UPGRADE';

            // Otherwise, simple check
            return 'UPGRADE';
        }

        // 3. EXPAND: If Tier 2 (Max) OR explicitly blocked
        const existingSettlements = Object.values(state.settlements);
        const bestSpot = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, existingSettlements);
        if (bestSpot) {
            return 'EXPAND';
        }

        // 4. TOOLS (Default surplus dump)
        return 'TOOLS';
    }
}
