import { AIAction, AIStrategy } from './AITypes';
import { WorldState, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class TradeStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(source => {
            if (source.stockpile.Gold < 1) return;

            // Identify Deficit (Logic from CaravanSystem.processTrade)
            const goal = source.currentGoal || 'TOOLS';
            let deficits: string[] = [];

            if (goal === 'UPGRADE') {
                const nextTier = source.tier + 1;
                const cost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
                if (source.stockpile.Timber < cost.costTimber) deficits.push('Timber');
                if (source.stockpile.Stone < cost.costStone) deficits.push('Stone');
                if ('costOre' in cost && source.stockpile.Ore < (cost as any).costOre) deficits.push('Ore');
            } else if (goal === 'EXPAND') {
                const cost = config.costs.settlement;
                if (source.stockpile.Food < (cost.Food || 500)) deficits.push('Food');
                if (source.stockpile.Timber < (cost.Timber || 200)) deficits.push('Timber');
            } else if (goal === 'SURVIVE') {
                const consumption = Math.max(5, source.population * config.costs.baseConsume);
                if (source.stockpile.Food < consumption * 50) deficits.push('Food');
            } else if (goal === 'TOOLS') {
                if (source.stockpile.Timber < 100) deficits.push('Timber');
                if (source.stockpile.Ore < 50) deficits.push('Ore');
            }

            if (deficits.length === 0) return;
            const neededRes = deficits[0] as keyof Resources;

            // Find Neighbor with Surplus
            const potentialTargets = Object.values(state.settlements).filter(t => t.id !== source.id);
            const target = potentialTargets.find(t => {
                const tCons = Math.max(5, t.population * config.costs.baseConsume);
                const surplusThreshold = neededRes === 'Food' ? tCons * 20 : 100;
                return t.stockpile[neededRes] > surplusThreshold;
            });

            if (target) {
                const existingRoute = Object.values(state.agents).find(a =>
                    a.type === 'Caravan' &&
                    a.ownerId === source.ownerId &&
                    a.mission === 'TRADE' &&
                    a.targetSettlementId === target.id &&
                    a.tradeResource === neededRes
                );

                if (existingRoute) return;

                const goldPerRes = config.costs.trade?.simulatedGoldPerResource || 1;
                const capacity = config.costs.trade?.capacity || 50;
                const afford = Math.floor(source.stockpile.Gold / goldPerRes);
                const amount = Math.min(capacity, afford, target.stockpile[neededRes]);
                const tradeValue = amount * goldPerRes;
                const roiThreshold = config.costs.logistics?.tradeRoiThreshold || 20;

                if (tradeValue >= roiThreshold) {
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
                        }
                    });
                }
            }
        });

        return actions;
    }
}
