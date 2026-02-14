<<<<<<< Updated upstream
import { WorldState } from '../../types/WorldTypes.ts';
import { SimulationStats } from './HeadlessRunner.ts';

export const calculateFitness = (_state: WorldState, stats: SimulationStats, factionId: string, _generation: number = 0): number => {
    let score = 0;
    const fStats = stats.factions[factionId];

    if (!fStats) return 0; // Should not happen

    // 1. Historical Stability (Population)
    // Buffed population weight (1 pop = 50 gold equivalent)
    score += (fStats.population * 5);

    // City Momentum Bonus: Extra points for crossing population milestones
    if (fStats.population >= 200) score += 5000;
    if (fStats.population >= 400) score += 10000;

    // 2. Expansion & Settlement Efficiency
    // We reward founding new settlements (+2000 per success)
    score += (fStats.settlementsFounded * 2000);

    // Reward Settler Spawning (Intent to expand)
    score += (fStats.settlersSpawned * 200);

    // Urbanization Density: Reward high population-to-settlement ratio.
    if (fStats.settlementsFounded > 0) {
        const density = fStats.population / (fStats.settlementsFounded + 1); 
        score += (density * 10);
    }

    // 3. Commercial Activity
    // Reward successful trades to offset the cost of building caravans
    score += (fStats.totalTrades * 50);

    // 4. Longevity Reward (Positive enforcement)
    score += Math.floor(stats.totalTicks / 100);

    // 5. Goals & Milestones
    // Tier Up
    const tierScore = Math.pow(1.5, fStats.tiersReached) * 1000;
    score += tierScore;

    // 6. Smooth Governance Bonus (+15%)
    if (!fStats.enteredSurviveMode) {
        score *= 1.15;
    }

    // 7. Territory & Resource Management
    score += (fStats.territorySize * 50);

    // Logistics Efficiency Penalty (Waste)
    // Snapshot of uncollected resources at the end.
    // Ensure value is a number to prevent NaN in score
    const waste = Number(fStats.resourceWaste) || 0;
    score -= (waste * 0.1);

    // 8. Penalty for dying/stagnation (The "Total Collapse" Multiplier)
    // If population < 1, they effectively went extinct.
    // 90% reduction in total score ensures dead factions cannot win on wealth alone.
    if (fStats.population < 1) {
        score *= 0.1;
    }

    // 7. Idle Penalty
    score -= (fStats.idleTicks * 0.05);

    return Math.max(0, score);
};

=======
import { WorldState } from '../../types/WorldTypes.ts';
import { SimulationStats } from './HeadlessRunner.ts';

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
    // 1.5x for every tier reached (Buffed from 1.25x)
    // Tier 0 = 1x
    // Tier 1 = 1.5x
    // Tier 2 = 2.25x
    const tierMultiplier = Math.pow(1.5, stats.tiersReached);
    score *= tierMultiplier;

    // 4. Smooth Governance Bonus (+15%)
    // If they never entered SURVIVE mode
    if (!stats.enteredSurviveMode) {
        score *= 1.15;
    }

    Object.values(state.settlements).forEach(s => {
        score += 100; // Base settlement score
        if (s.tier === 1) score += 1000; // Buffed from 500
        if (s.tier === 2) score += 2500; // Buffed from 2000

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

    // 5. Gold Reserve (Nerfed from 0.1 to 0.001)
    const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
    score += (totalGold * 0.001);

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
>>>>>>> Stashed changes
