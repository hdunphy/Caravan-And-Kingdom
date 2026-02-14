<<<<<<< Updated upstream
import { GameConfig } from '../../types/GameConfig.ts';

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

    // New Genes (Economy & Expansion)
    recruitBuffer: number;
    villagerJobScoreMulti: number;
    expansionBuffer: number;
    tradeRoiThreshold: number;
    constructionRoiThreshold: number;
    targetToolRatio: number;

    // Sovereign Policy
    sovereignFoodSurplus: number;
    sovereignDesperationRatio: number;

    // Agent Bidding
    bidDistanceWeight: number;
    bidSaturationWeight: number;
    bidFulfillmentWeight: number;
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

    // New Mappings
    recruitBuffer: config.ai.thresholds.recruitBuffer,
    villagerJobScoreMulti: config.ai.thresholds.villagerJobScoreMulti,
    expansionBuffer: config.ai.expansionBuffer,
    tradeRoiThreshold: config.costs.logistics.tradeRoiThreshold,
    constructionRoiThreshold: config.costs.logistics.constructionRoiThreshold,
    targetToolRatio: config.industry.targetToolRatio,

    // Sovereign
    sovereignFoodSurplus: config.ai.sovereign.foodSurplusRatio,
    sovereignDesperationRatio: config.ai.sovereign.desperationFoodRatio,

    // Bidding
    bidDistanceWeight: config.ai.bidding.distanceWeight,
    bidSaturationWeight: config.ai.bidding.saturationWeight,
    bidFulfillmentWeight: config.ai.bidding.fulfillmentWeight,
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

    // New Mappings
    newConfig.ai.thresholds.recruitBuffer = genome.recruitBuffer;
    newConfig.ai.thresholds.villagerJobScoreMulti = genome.villagerJobScoreMulti;
    newConfig.ai.expansionBuffer = genome.expansionBuffer;
    newConfig.costs.logistics.tradeRoiThreshold = genome.tradeRoiThreshold;
    newConfig.costs.logistics.constructionRoiThreshold = genome.constructionRoiThreshold;
    newConfig.industry.targetToolRatio = genome.targetToolRatio;

    // Sovereign
    newConfig.ai.sovereign.foodSurplusRatio = genome.sovereignFoodSurplus;
    newConfig.ai.sovereign.desperationFoodRatio = genome.sovereignDesperationRatio;

    // Bidding
    newConfig.ai.bidding.distanceWeight = genome.bidDistanceWeight;
    newConfig.ai.bidding.saturationWeight = genome.bidSaturationWeight;
    newConfig.ai.bidding.fulfillmentWeight = genome.bidFulfillmentWeight;

    return newConfig;
};
=======
import { GameConfig } from '../../types/GameConfig.ts';

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

    // New Genes (Economy & Expansion)
    recruitBuffer: number;
    villagerJobScoreMulti: number;
    expansionBuffer: number;
    tradeRoiThreshold: number;
    constructionRoiThreshold: number;
    targetToolRatio: number;
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

    // New Mappings
    recruitBuffer: config.ai.thresholds.recruitBuffer,
    villagerJobScoreMulti: config.ai.thresholds.villagerJobScoreMulti,
    expansionBuffer: config.ai.expansionBuffer,
    tradeRoiThreshold: config.costs.logistics.tradeRoiThreshold,
    constructionRoiThreshold: config.costs.logistics.constructionRoiThreshold,
    targetToolRatio: config.industry.targetToolRatio,
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

    // New Mappings
    newConfig.ai.thresholds.recruitBuffer = genome.recruitBuffer;
    newConfig.ai.thresholds.villagerJobScoreMulti = genome.villagerJobScoreMulti;
    newConfig.ai.expansionBuffer = genome.expansionBuffer;
    newConfig.costs.logistics.tradeRoiThreshold = genome.tradeRoiThreshold;
    newConfig.costs.logistics.constructionRoiThreshold = genome.constructionRoiThreshold;
    newConfig.industry.targetToolRatio = genome.targetToolRatio;

    return newConfig;
};
>>>>>>> Stashed changes
