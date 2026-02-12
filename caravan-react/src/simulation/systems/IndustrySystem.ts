import { WorldState } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';

export const IndustrySystem = {
    update(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(settlement => {
            // Simple Industry Logic: Maintain Tools = Population
            // Recipe: defined in config

            const TIMBER_COST = config.industry.costTimber;
            const ORE_COST = config.industry.costOre;
            const TARGET_TOOLS = Math.ceil(settlement.population * config.industry.targetToolRatio);

            // Priority Logic:
            // 1. If Goal == TOOLS: Produce until Target Ratio?
            // 2. If Goal != TOOLS: Produce ONLY if surplus timber/ore exists.

            const goal = settlement.currentGoal || 'TOOLS';
            const SURPLUS_THRESHOLD = config.industry.surplusThreshold || 50; // Keep 50 for upgrades/expansion

            let canProduce = false;

            if (goal === 'TOOLS') {
                canProduce = true;
            } else {
                // Surplus Check
                if (settlement.stockpile.Timber > (TIMBER_COST + SURPLUS_THRESHOLD) &&
                    settlement.stockpile.Ore > (ORE_COST + SURPLUS_THRESHOLD)) {
                    canProduce = true;
                }
            }

            // Check if we need tools
            if (canProduce && settlement.stockpile.Tools < TARGET_TOOLS) {
                // Check materials
                if (settlement.stockpile.Timber >= TIMBER_COST && settlement.stockpile.Ore >= ORE_COST) {
                    // Produce
                    settlement.stockpile.Timber -= TIMBER_COST;
                    settlement.stockpile.Ore -= ORE_COST;
                    settlement.stockpile.Tools += 1;
                }
            }
        });
    }
};
