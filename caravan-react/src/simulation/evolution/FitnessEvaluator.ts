import { WorldState } from '../../types/WorldTypes';
import { SimulationStats } from './HeadlessRunner';

export const calculateFitness = (state: WorldState, stats: SimulationStats, generation: number = 0): number => {
    let score = 0;

    // 1. Historical Stability (Median Population)
    // Instead of just final pop, we use the median of history to reward consistent growth.
    const sortedPop = [...stats.popHistory].sort((a, b) => a - b);
    const medianPop = sortedPop.length > 0 ? sortedPop[Math.floor(sortedPop.length / 2)] : 0;
    score += medianPop;

    // 2. Longevity Reward (Positive enforcement)
    // Reward simply for existing. 1 point per 100 ticks survived.
    score += Math.floor(stats.totalTicks / 100);

    // 3. Tier Multiplier
    // 1.25x for every tier reached.
    // Tier 0 = 1x
    // Tier 1 = 1.25x
    // Tier 2 = 1.56x
    const tierMultiplier = Math.pow(1.25, stats.tiersReached);
    score *= tierMultiplier;

    // 4. Smooth Governance Bonus (+15%)
    // If they never entered SURVIVE mode
    if (!stats.enteredSurviveMode) {
        score *= 1.15;
    }

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

    // 5. Gold Reserve
    const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
    score += (totalGold * 0.1);

    // 6. Penalty for dying out
    if (Object.keys(state.settlements).length === 0) {
        // Reduced penalty for early generations to encourage exploration
        const deathPenalty = generation < 50 ? 500 : 5000;
        score -= deathPenalty;

    }

    // 7. Idle Penalty (-0.05 per Idle Tick - Reduced impact)
    // We want some idle for buffer, but not laziness.
    score -= (stats.idleTicks * 0.05);

    return Math.max(0, score);
};
