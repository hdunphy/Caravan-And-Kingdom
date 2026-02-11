import { AIAction, AIStrategy } from './AITypes';
import { WorldState, Resources, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export class TradeStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(source => {
            const goal = source.currentGoal || 'TOOLS';
            const deficits: { res: keyof Resources, score: number }[] = [];
            const surplus: { res: keyof Resources, amount: number, score: number }[] = [];

            // 1. Identify NEED (Buy)
            const checkDeficit = (res: keyof Resources, current: number, required: number, importance: number) => {
                if (current < required) {
                    deficits.push({ res, score: (1.0 - current / required) * importance });
                }
            };

            if (goal === 'UPGRADE') {
                const nextTier = source.tier + 1;
                // Simplified tier lookup
                const cost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
                checkDeficit('Timber', source.stockpile.Timber, cost.costTimber, 2.0);
                checkDeficit('Stone', source.stockpile.Stone, cost.costStone, 2.0);
            } else if (goal === 'EXPAND') {
                checkDeficit('Food', source.stockpile.Food, config.costs.settlement.Food || 500, 2.0);
                checkDeficit('Timber', source.stockpile.Timber, config.costs.settlement.Timber || 200, 2.0);
            } else if (goal === 'SURVIVE') {
                const consumption = Math.max(5, source.population * config.costs.baseConsume);
                checkDeficit('Food', source.stockpile.Food, config.ai.thresholds.surviveFood || consumption * 50, 3.0);
            }

            // 2. Identify Surplus (Sell)
            const lowGoldScore = source.stockpile.Gold < config.costs.trade.forceTradeGold ? 2.0 : 0.5;
            ['Timber', 'Stone', 'Ore', 'Food'].forEach(r => {
                const res = r as keyof Resources;
                const threshold = config.industry.surplusThreshold || 100;
                let specificThreshold = threshold;
                if (res === 'Food') specificThreshold = (source.population * config.costs.baseConsume) * config.ai.utility.surviveThreshold;

                if (source.stockpile[res] > specificThreshold) {
                    const ratio = source.stockpile[res] / specificThreshold;
                    // Cap ratio at 3.0 for scoring logic
                    surplus.push({
                        res,
                        amount: source.stockpile[res] - specificThreshold,
                        score: (Math.min(2.0, ratio - 1.0)) * lowGoldScore
                    });
                }
            });

            if (deficits.length === 0 && surplus.length === 0) return;

            const sourceHex = state.map[source.hexId];
            if (!sourceHex) return;

            // Process Deficits (Buy)
            if (deficits.length > 0) {
                deficits.sort((a, b) => b.score - a.score);
                const topDeficit = deficits[0];
                const neededRes = topDeficit.res;

                const potentialTargets = Object.values(state.settlements).filter(t => t.id !== source.id);
                let bestPartner: { settlement: Settlement; score: number } | null = null;

                for (const t of potentialTargets) {
                    const tCons = Math.max(5, t.population * config.costs.baseConsume);
                    const surplusThreshold = neededRes === 'Food' ? tCons * config.costs.trade.neighborSurplusMulti : config.industry.surplusThreshold;

                    if (t.stockpile[neededRes] > surplusThreshold) {
                        const targetHex = state.map[t.hexId];
                        const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);

                        // Distance Penalty
                        const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
                        const distFactor = 1.0 + (dist * 0.1);

                        // Penalize score by travel cost
                        const adjustedScore = (topDeficit.score / distFactor) - (travelCost * 0.001);

                        if (!bestPartner || adjustedScore > bestPartner.score) {
                            bestPartner = { settlement: t, score: adjustedScore };
                        }
                    }
                }

                if (bestPartner) {
                    const target = bestPartner.settlement;
                    const existingRoute = Object.values(state.agents).find(a =>
                        a.type === 'Caravan' && a.ownerId === source.ownerId && a.mission === 'TRADE' &&
                        a.targetSettlementId === target.id && a.tradeResource === neededRes
                    );

                    if (!existingRoute) {
                        const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
                        const capacity = config.costs.trade.capacity || 50;
                        const afford = Math.floor(source.stockpile.Gold / goldPerRes);
                        const amount = Math.min(capacity, afford, target.stockpile[neededRes]);
                        const tradeValue = amount * goldPerRes;

                        const targetHex = state.map[target.hexId];
                        const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
                        const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);

                        // Strict ROI Check including travel cost
                        if (tradeValue > estimatedTravelCost && tradeValue >= config.costs.logistics.tradeRoiThreshold) {
                            actions.push({
                                type: 'DISPATCH_CARAVAN',
                                settlementId: source.id,
                                targetHexId: target.hexId,
                                mission: 'TRADE',
                                context: {
                                    targetId: target.id,
                                    resource: neededRes,
                                    gold: amount * goldPerRes,
                                    value: tradeValue
                                },
                                score: bestPartner.score
                            });
                        }
                    }
                }
            }

            // Process Surplus (Sell)
            if (surplus.length > 0) {
                surplus.sort((a, b) => b.score - a.score);
                const topSurplus = surplus[0];
                const sellRes = topSurplus.res;

                const potentialBuyers = Object.values(state.settlements).filter(t => t.id !== source.id);
                let bestBuyer: { settlement: Settlement; score: number } | null = null;

                for (const t of potentialBuyers) {
                    // Strict Gold Check: Can they buy at least 5 units?
                    const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
                    const minBuy = 5;

                    if (t.stockpile.Gold >= minBuy * goldPerRes) {
                        const targetHex = state.map[t.hexId];
                        const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
                        const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
                        const distFactor = 1.0 + (dist * 0.1);
                        const adjustedScore = (topSurplus.score / distFactor) - (travelCost * 0.001);

                        if (!bestBuyer || adjustedScore > bestBuyer.score) {
                            bestBuyer = { settlement: t, score: adjustedScore };
                        }
                    }
                }

                if (bestBuyer) {
                    const target = bestBuyer.settlement;
                    const existingRoute = Object.values(state.agents).find(a =>
                        a.type === 'Caravan' && a.ownerId === source.ownerId && a.mission === 'TRADE' &&
                        a.targetSettlementId === target.id && a.tradeResource === sellRes
                    );

                    if (!existingRoute) {
                        const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
                        const capacity = config.costs.trade.capacity || 50;
                        const amount = Math.min(capacity, topSurplus.amount, Math.floor(target.stockpile.Gold / goldPerRes));
                        const tradeValue = amount * goldPerRes;

                        const targetHex = state.map[target.hexId];
                        const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
                        const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);

                        // Net Profit Logic
                        if (tradeValue > estimatedTravelCost && tradeValue >= config.costs.logistics.tradeRoiThreshold) {
                            actions.push({
                                type: 'DISPATCH_CARAVAN',
                                settlementId: source.id,
                                targetHexId: target.hexId,
                                mission: 'TRADE',
                                context: {
                                    targetId: target.id,
                                    resource: sellRes,
                                    gold: 0,
                                    value: tradeValue
                                },
                                score: bestBuyer.score
                            });
                        }
                    }
                }
            }
        });

        return actions;
    }
}
