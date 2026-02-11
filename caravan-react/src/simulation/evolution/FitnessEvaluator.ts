import { WorldState } from '../../types/WorldTypes';
import { SimulationStats } from './HeadlessRunner';

export const calculateFitness = (state: WorldState, stats: SimulationStats): number => {
    let score = 0;

    // 1. Population is the primary driver (+1 per pop)
    const totalPop = Object.values(state.settlements).reduce((sum, s) => sum + s.population, 0);
    score += totalPop;

    // 2. Tiers represent major milestones
    Object.values(state.settlements).forEach(s => {
        score += 100; // Base settlement score
        if (s.tier === 1) score += 500;
        if (s.tier === 2) score += 2000;

        // Diversity Bonus (+100 Max)
        // Spread between largest and smallest stockpile (excluding Tools/Gold)
        // Ideally we want balanced resources.
        // Wait, "Spread" usually means Difference. If Spread is SMALL, that's GOOD (Balanced).
        // Rules: Spread <= 500 -> 100 pts. Spread >= 2000 -> 0 pts.
        const stock = s.stockpile;
        const resources = [stock.Food, stock.Timber, stock.Stone, stock.Ore]; // Exclude Tools/Gold? Prompt says "excluding Tools". assume Gold too.
        const min = Math.min(...resources);
        const max = Math.max(...resources);
        const spread = max - min;

        if (spread <= 500) {
            score += 100;
        } else if (spread < 2000) {
            // Linear interpolation from 500 (100pts) to 2000 (0pts)
            // range is 1500.
            // value = 1.0 - ((spread - 500) / 1500)
            const factor = 1.0 - ((spread - 500) / 1500);
            score += (100 * factor);
        }
    });

    // 3. Gold is good but secondary
    const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
    score += (totalGold * 0.1);

    //Question does this count if a settlement was founded and then died out?
    // 4. Penalty for dying out
    if (Object.keys(state.settlements).length === 0) {
        score -= 5000;
    }

    // 5. Stability Penalty (Normalized Power Curve)
    // Formula: Penalty = -3000 * (Actual_Survival_Ticks / (numTicks * numFactions))^1.5
    const totalPotentialTicks = stats.totalTicks * stats.totalFactions;
    if (totalPotentialTicks > 0) {
        const survivalRatio = stats.survivalTicks / totalPotentialTicks;
        const survivalPenalty = 3000 * Math.pow(survivalRatio, 1.5);
        score -= survivalPenalty;
    }

    // 6. Idle Penalty (-0.1 per Idle Tick)
    score -= (stats.idleTicks * 0.1);

    return Math.max(0, score);
};
