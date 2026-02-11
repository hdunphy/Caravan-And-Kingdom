import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export const MetabolismSystem = {
    update(state: WorldState, config: GameConfig, silent: boolean = false) {
        Object.values(state.settlements).forEach(settlement => {
            const pop = settlement.population;
            const foodConsumption = pop * config.costs.baseConsume;

            // 1. LABOR SATURATION CHECK
            // Total jobs available = (controlled hexes) * maxLaborPerHex
            const hexCount = settlement.controlledHexIds.length || 7;
            const maxJobs = hexCount * config.costs.maxLaborPerHex;
            const workingPop = Math.min(pop, maxJobs);

            // 2. CONSUMPTION & GROWTH
            if (settlement.stockpile.Food >= foodConsumption) {
                const surplus = settlement.stockpile.Food - foodConsumption;
                settlement.stockpile.Food = surplus;

                // Growth only happens if there is a surplus.
                // We multiply by (workingPop / pop) to simulate 
                // that overcrowding slows down growth rate.
                const pressureFactor = pop > 0 ? (workingPop / pop) : 1;

                // Surplus Bonus: only if we have more food than the cost of a new settlement
                const settlementCost = config.costs.settlement.Food || 500;
                let surplusBonus = 0;

                if (settlement.stockpile.Food > settlementCost) {
                    const extra = settlement.stockpile.Food - settlementCost;
                    const surplusRatio = foodConsumption > 0 ? (extra / foodConsumption) : 0;
                    surplusBonus = surplusRatio * (config.costs.growthSurplusBonus || 0.0001);
                }

                const baseGrowth = (config.costs.growthRate || 0.008);
                let finalGrowthRate = (baseGrowth + surplusBonus) * pressureFactor;

                // Enforce Population Cap based on Tier
                let cap = config.upgrades.villageToTown.popCap || 200; // Tier 0
                if (settlement.tier === 1) cap = config.upgrades.townToCity.popCap || 500;
                if (settlement.tier >= 2) cap = (config.upgrades as any).city?.popCap || 2000;

                if (settlement.population >= cap) {
                    // Soft Cap: Drastically reduce growth (10% of normal) due to overcrowding
                    finalGrowthRate *= 0.1;
                }

                settlement.population += pop * finalGrowthRate;
                settlement.lastGrowth = pop * finalGrowthRate;
            } else {
                settlement.stockpile.Food = 0;
                // Starvation: Lowered default from 0.02 to 0.005 (0.5% per tick) to prevent death spiral
                const starvationLoss = pop * (config.costs.starvationRate || 0.005);
                settlement.population -= starvationLoss;
                settlement.lastGrowth = -starvationLoss;
            }
            // Clamp lowest pop to 0
            settlement.population = Math.max(0, settlement.population);

            // TAX / PASSIVE INCOME
            // Settlements generate small amount of gold from population interaction (Commerce)
            const taxRate = config.economy?.taxRate || 0.005; // 0.5 Gold per 100 pop per tick
            settlement.stockpile.Gold += settlement.population * taxRate;

            // DEATH CHECK
            if (settlement.population <= 0) {
                // Remove settlement
                // We need to mutate state.settlements AND cleanup map ownership
                if (!silent) console.log(`[DEATH] Settlement ${settlement.name} has died out.`);

                // Clear Map Ownership
                if (settlement.controlledHexIds) {
                    settlement.controlledHexIds.forEach(id => {
                        if (state.map[id]) state.map[id].ownerId = null;
                    });
                }
                delete state.settlements[settlement.id];
            }
        });
    }
};
