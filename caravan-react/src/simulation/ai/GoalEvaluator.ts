import { WorldState, Settlement, GoalType } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { MapGenerator } from '../MapGenerator';

export class GoalEvaluator {
    static evaluate(state: WorldState, settlement: Settlement, config: GameConfig): GoalType {
        // Dynamic Consumption Rate
        const consumption = settlement.population * config.costs.baseConsume;

        // Hysteresis for Survival
        // Enter SURVIVE if < 10 ticks of food
        const criticalThreshold = Math.max(config.ai.thresholds.surviveFood, consumption * 20);
        // Exit SURVIVE only if > 30 ticks of food (buffer)
        const safeThreshold = criticalThreshold * 2.0;

        if (settlement.currentGoal === 'SURVIVE') {
            if (settlement.stockpile.Food < safeThreshold) return 'SURVIVE'; // Stay in panic
        } else {
            if (settlement.stockpile.Food < criticalThreshold) return 'SURVIVE'; // Enter panic
        }

        // 2. UPGRADE: If not max tier
        if (settlement.tier < 2) {
            // Check limits
            let cap = config.upgrades.villageToTown.popCap || 200;
            if (settlement.tier === 1) cap = config.upgrades.townToCity.popCap || 500;

            // If we are at 80% capacity, FORCE upgrade priority
            if (settlement.population > cap * 0.8) return 'UPGRADE';

            // Otherwise, simple check (if not survival, we prefer upgrading or expanding)
            return 'UPGRADE';
        }

        // 3. EXPAND: If Tier 2 (Max) OR explicitly blocked? 
        // User said: "AddSettler (if new spot exists)"
        // We should check if expansion is possible.
        // We need existing settlements to pass to findExpansionLocation
        const existingSettlements = Object.values(state.settlements);

        // This check is expensive if done every tick. 
        // We might want to cache this or specific AIController tick.
        // For now, let's assume valid.
        // But we need to verify IF a spot exists.
        const bestSpot = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, existingSettlements);
        if (bestSpot) {
            return 'EXPAND';
        }

        // 4. TOOLS (Default surplus dump)
        return 'TOOLS';
    }
}
