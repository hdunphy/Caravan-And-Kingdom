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

    // 5. Territory & Wealth (Gold nerfed relative to life)
    score += (fStats.territorySize * 50);
    score += (fStats.totalWealth * 0.01);

    // 6. Penalty for dying/stagnation (The "Total Collapse" Multiplier)
    // If population < 1, they effectively went extinct.
    // 90% reduction in total score ensures dead factions cannot win on wealth alone.
    if (fStats.population < 1) {
        score *= 0.1;
    }

    // 7. Idle Penalty
    score -= (fStats.idleTicks * 0.05);

    return Math.max(0, score);
};

