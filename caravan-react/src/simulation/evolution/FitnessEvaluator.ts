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

