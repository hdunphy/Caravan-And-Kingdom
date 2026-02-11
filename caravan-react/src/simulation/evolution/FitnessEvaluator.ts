import { WorldState } from '../../types/WorldTypes';

export const calculateFitness = (state: WorldState): number => {
    let score = 0;
    
    // 1. Population is the primary driver
    const totalPop = Object.values(state.settlements).reduce((sum, s) => sum + s.population, 0);
    score += totalPop;
    
    // 2. Tiers represent major milestones
    Object.values(state.settlements).forEach(s => {
        if (s.tier === 1) score += 500;
        if (s.tier === 2) score += 2000;
    });
    
    // 3. Gold is good but secondary
    const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
    score += (totalGold * 0.1);
    
    // 4. Penalty for dying out
    // If we start with 1 settlement and end with 0, that's bad.
    if (Object.keys(state.settlements).length === 0) {
        score -= 5000;
    }
    
    // 5. Reward for expansion
    score += (Object.keys(state.settlements).length * 100);

    return Math.max(0, score);
};
