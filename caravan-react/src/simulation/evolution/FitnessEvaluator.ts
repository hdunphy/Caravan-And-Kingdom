import { WorldState } from '../../types/WorldTypes.ts';
import { SimulationStats } from './HeadlessRunner.ts';

export const calculateFitness = (_state: WorldState, stats: SimulationStats, factionId: string, generation: number = 0): number => {
    let score = 0;
    const fStats = stats.factions[factionId];

    if (!fStats) return 0; // Should not happen

    // 1. Historical Stability (Median Population)
    // Not tracked per faction currently in new stats, only current pop?
    // We only have global popHistory. 
    // Let's use current population as a proxy or we need to track local pop history.
    // For now, use current population.
    score += fStats.population;

    // 2. Longevity Reward (Positive enforcement)
    // Reward simply for existing. 1 point per 100 ticks survived.
    // If they died early, their data might be stale, but we don't track death time yet.
    // Assuming they survived if they have stats? 
    // HeadlessRunner breaks early if ALL die.
    score += Math.floor(stats.totalTicks / 100);

    // 3. Goals & Milestones
    // Tier Up
    const tierScore = Math.pow(1.5, fStats.tiersReached) * 1000;
    score += tierScore;

    // Goal Completion
    if (fStats.goalsCompleted) {
        Object.entries(fStats.goalsCompleted).forEach(([goal, count]) => {
            if (goal === 'TIER_UP') score += (2000 * count);
            // Add other goals if we track them (SETTLER, etc)
        });
    }

    // 4. Smooth Governance Bonus (+15%)
    // If they never entered SURVIVE mode
    if (!fStats.enteredSurviveMode) {
        score *= 1.15;
    }

    // 5. Territory & Wealth
    score += (fStats.territorySize * 50);
    score += (fStats.totalWealth * 0.1);

    // 6. Penalty for dying/stagnation
    // If population is 0, they died.
    if (fStats.population === 0) {
        const deathPenalty = generation < 50 ? 500 : 5000;
        score -= deathPenalty;
    }

    // 7. Idle Penalty
    score -= (fStats.idleTicks * 0.05);

    return Math.max(0, score);
};

