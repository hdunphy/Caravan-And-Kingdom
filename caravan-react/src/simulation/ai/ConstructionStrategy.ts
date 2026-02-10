import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class ConstructionStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(settlement => {
            const minBuffer = config.ai.thresholds.minConstructionBuffer || 50;
            if (settlement.stockpile.Stone < minBuffer || settlement.stockpile.Timber < minBuffer) return;

            // 1. Check for Gatherer's Hut (Food)
            const needsFood = settlement.currentGoal === 'SURVIVE' || settlement.stockpile.Food < config.ai.thresholds.surviveFood * 2;

            if (needsFood) {
                const target = settlement.controlledHexIds.find(id => {
                    const hex = state.map[id];
                    if (!hex || hex.terrain !== 'Plains') return false;
                    return !settlement.buildings?.some(b => b.hexId === id);
                });

                if (target) {
                    actions.push({ type: 'BUILD', settlementId: settlement.id, buildingType: 'GathererHut', hexId: target });
                    return; // One build per tick per settlement
                }
            }

            // 2. Guard Post (Surplus logic)
            const surplusTimber = config.ai.thresholds.militarySurplusTimber || 200;
            const surplusStone = config.ai.thresholds.militarySurplusStone || 100;

            if (settlement.stockpile.Timber > surplusTimber && settlement.stockpile.Stone > surplusStone) {
                const target = settlement.controlledHexIds.find(id => {
                    return !settlement.buildings?.some(b => b.hexId === id);
                });

                if (target && Math.random() < (config.ai.chances.guardPostBuild || 0.05)) {
                    actions.push({ type: 'BUILD', settlementId: settlement.id, buildingType: 'GuardPost', hexId: target });
                }
            }
        });

        return actions;
    }
}
