import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class ConstructionStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string, settlementId?: string): AIAction[] {
        const actions: AIAction[] = [];
        let factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        if (settlementId) {
            factionSettlements = factionSettlements.filter(s => s.id === settlementId);
        }

        factionSettlements.forEach(settlement => {
            const minBuffer = config.ai.thresholds.minConstructionBuffer || 50;
            if (settlement.stockpile.Stone < minBuffer || settlement.stockpile.Timber < minBuffer) return;

            // ==========================================
            // DESIRE 5: BUILD (Infrastructure)
            // ==========================================

            // 1. Gatherer's Hut (Food)
            // Goal: Boost production if consumption is high
            // Formula approximation: (Consumption / Production) - Saturation

            const consumption = settlement.population * config.costs.baseConsume;
            // Effective production proxy: Net Food change? Or just simple threshold?
            // If Stockpile is dropping, we need production.
            // Using Stockpile/Threshold ratio as proxy for Con/Prod health.
            const threshold = consumption * (config.ai?.utility?.surviveThreshold || 15);
            const foodHealth = settlement.stockpile.Food / (threshold || 1);

            // Saturation: Huts / Plains
            const plains = settlement.controlledHexIds.filter(id => state.map[id]?.terrain === 'Plains');
            const huts = settlement.buildings.filter(b => b.type === 'GathererHut').length;
            const saturation = plains.length > 0 ? (huts / plains.length) : 1.0;

            // Score: High if foodHealth is low AND saturation is low.
            // If foodHealth < 1.0, we are in danger.
            // value = (1.0 - foodHealth)
            // Modifiers: +0.2 if goal is SURVIVE
            let buildScore = (1.0 - foodHealth); // Removed * 2.0 to prioritize immediate gathering
            if (settlement.aiState?.surviveMode) buildScore += 0.2; // Reduced bonus

            // Penalize high saturation
            buildScore *= (1.0 - saturation);

            if (buildScore > 0.1) {
                const target = plains.find(id => !settlement.buildings?.some(b => b.hexId === id));
                if (target) {
                    actions.push({
                        type: 'BUILD',
                        settlementId: settlement.id,
                        buildingType: 'GathererHut',
                        targetHexId: target,
                        score: buildScore
                    });
                }
            }

            //Wait until we properly implement the military AI
            // 2. Guard Post (Surplus logic)
            // const surplusTimber = config.ai.thresholds.militarySurplusTimber || 200;
            // if (settlement.stockpile.Timber > surplusTimber) {
            //     const surplusRatio = settlement.stockpile.Timber / surplusTimber;
            //     // Asymptotic score: Approach 0.5 as ratio -> Infinity
            //     const guardScore = (1.0 - (1.0 / surplusRatio)) * 0.5;

            //     if (guardScore > 0.05) {
            //         const target = settlement.controlledHexIds.find(id => !settlement.buildings?.some(b => b.hexId === id));
            //         if (target) {
            //             actions.push({
            //                 type: 'BUILD',
            //                 settlementId: settlement.id,
            //                 buildingType: 'GuardPost',
            //                 hexId: target,
            //                 score: guardScore
            //             });
            //         }
            //     }
            // }
        });

        return actions;
    }
}
