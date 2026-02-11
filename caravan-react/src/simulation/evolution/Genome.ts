import { GameConfig } from '../../types/GameConfig';

export interface Genome {
    // AI Utility Weights
    surviveThreshold: number;
    growthFoodSafety: number;
    provisionDistanceMulti: number;
    ascendReadinessPower: number;
    buildRateLookback: number;
    commercialLowThreshold: number;
    commercialSurplusThreshold: number;
    fleetTargetSize: number;
    expandSearchRadius: number;
    expandSaturationPower: number;
    expandMinDistance: number;
    
    // Costs & Efficiency
    villagerSpeed: number;
    caravanTimberCost: number;
}

export const configToGenome = (config: GameConfig): Genome => ({
    surviveThreshold: config.ai.utility.surviveThreshold,
    growthFoodSafety: config.ai.utility.growthFoodSafety,
    provisionDistanceMulti: config.ai.utility.provisionDistanceMulti,
    ascendReadinessPower: config.ai.utility.ascendReadinessPower,
    buildRateLookback: config.ai.utility.buildRateLookback,
    commercialLowThreshold: config.ai.utility.commercialLowThreshold,
    commercialSurplusThreshold: config.ai.utility.commercialSurplusThreshold,
    fleetTargetSize: config.ai.utility.fleetTargetSize,
    expandSearchRadius: config.ai.utility.expandSearchRadius,
    expandSaturationPower: config.ai.utility.expandSaturationPower,
    expandMinDistance: config.ai.utility.expandMinDistance,
    villagerSpeed: config.costs.villagers.speed,
    caravanTimberCost: config.costs.trade.caravanTimberCost
});

export const genomeToConfig = (genome: Genome, baseConfig: GameConfig): GameConfig => {
    const newConfig = JSON.parse(JSON.stringify(baseConfig));
    newConfig.ai.utility.surviveThreshold = genome.surviveThreshold;
    newConfig.ai.utility.growthFoodSafety = genome.growthFoodSafety;
    newConfig.ai.utility.provisionDistanceMulti = genome.provisionDistanceMulti;
    newConfig.ai.utility.ascendReadinessPower = genome.ascendReadinessPower;
    newConfig.ai.utility.buildRateLookback = genome.buildRateLookback;
    newConfig.ai.utility.commercialLowThreshold = genome.commercialLowThreshold;
    newConfig.ai.utility.commercialSurplusThreshold = genome.commercialSurplusThreshold;
    newConfig.ai.utility.fleetTargetSize = genome.fleetTargetSize;
    newConfig.ai.utility.expandSearchRadius = genome.expandSearchRadius;
    newConfig.ai.utility.expandSaturationPower = genome.expandSaturationPower;
    newConfig.ai.utility.expandMinDistance = genome.expandMinDistance;
    newConfig.costs.villagers.speed = genome.villagerSpeed;
    newConfig.costs.trade.caravanTimberCost = genome.caravanTimberCost;
    return newConfig;
};
