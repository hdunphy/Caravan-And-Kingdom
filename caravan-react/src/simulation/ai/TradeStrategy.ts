import { WorldState, Resources, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export interface TradeRoute {
    targetId: string;
    resource: keyof Resources;
    amount: number;
    gold: number;
    value: number;
    score: number;
}

export class TradeStrategy {
    /**
     * Finds the best trade partner for a settlement that needs a specific resource.
     */
    static findBestBuyer(source: Settlement, res: keyof Resources, amount: number, state: WorldState, config: GameConfig): TradeRoute | null {
        const potentialBuyers = Object.values(state.settlements).filter(t => t.id !== source.id);
        const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
        const sourceHex = state.map[source.hexId];
        if (!sourceHex) return null;

        let bestBuyer: { settlement: Settlement; score: number } | null = null;

        for (const t of potentialBuyers) {
            // Strict Gold Check
            const minBuy = 5;
            if (t.stockpile.Gold >= minBuy * goldPerRes) {
                const targetHex = state.map[t.hexId];
                const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
                const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
                const distFactor = 1.0 + (dist * 0.1);

                // Simple score: distance weighted
                const adjustedScore = (1.0 / distFactor) - (travelCost * 0.001);

                if (!bestBuyer || adjustedScore > bestBuyer.score) {
                    bestBuyer = { settlement: t, score: adjustedScore };
                }
            }
        }

        if (bestBuyer) {
            const target = bestBuyer.settlement;
            const capacity = config.costs.trade.capacity || 50;
            const finalAmount = Math.min(capacity, amount, Math.floor(target.stockpile.Gold / goldPerRes));
            const tradeValue = finalAmount * goldPerRes;

            const targetHex = state.map[target.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);

            if (tradeValue > estimatedTravelCost && tradeValue >= (config.costs.logistics?.tradeRoiThreshold || 20)) {
                return {
                    targetId: target.id,
                    resource: res,
                    gold: 0,
                    amount: finalAmount,
                    value: tradeValue,
                    score: bestBuyer.score
                };
            }
        }

        return null;
    }

    /**
     * Finds the best trade partner that HAS a resource the source settlement NEEDS.
     */
    static findBestSeller(source: Settlement, res: keyof Resources, state: WorldState, config: GameConfig): TradeRoute | null {
        const potentialSellers = Object.values(state.settlements).filter(t => t.id !== source.id);
        const sourceHex = state.map[source.hexId];
        if (!sourceHex) return null;

        let bestSeller: { settlement: Settlement; score: number } | null = null;

        for (const t of potentialSellers) {
            const tCons = Math.max(5, t.population * config.costs.baseConsume);
            const surplusThreshold = res === 'Food' ? tCons * config.costs.trade.neighborSurplusMulti : config.industry.surplusThreshold;

            if (t.stockpile[res] > surplusThreshold) {
                const targetHex = state.map[t.hexId];
                const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
                const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
                const distFactor = 1.0 + (dist * 0.1);

                const adjustedScore = (1.0 / distFactor) - (travelCost * 0.001);

                if (!bestSeller || adjustedScore > bestSeller.score) {
                    bestSeller = { settlement: t, score: adjustedScore };
                }
            }
        }

        if (bestSeller) {
            const target = bestSeller.settlement;
            const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
            const capacity = config.costs.trade.capacity || 50;
            const afford = Math.floor(source.stockpile.Gold / goldPerRes);
            const finalAmount = Math.min(capacity, afford, target.stockpile[res]);
            const tradeValue = finalAmount * goldPerRes;

            const targetHex = state.map[target.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);

            if (tradeValue > estimatedTravelCost && tradeValue >= (config.costs.logistics?.tradeRoiThreshold || 20)) {
                return {
                    targetId: target.id,
                    resource: res,
                    gold: finalAmount * goldPerRes,
                    amount: finalAmount,
                    value: tradeValue,
                    score: bestSeller.score
                };
            }
        }

        return null;
    }
}
