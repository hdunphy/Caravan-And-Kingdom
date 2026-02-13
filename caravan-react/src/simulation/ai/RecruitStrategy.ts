import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class RecruitStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string, settlementId?: string): AIAction[] {
        const actions: AIAction[] = [];
        let factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        if (settlementId) {
            factionSettlements = factionSettlements.filter(s => s.id === settlementId);
        }

        factionSettlements.forEach(settlement => {
            // ==========================================
            // DESIRE 2: GROW (Workforce Recruitment)
            // ==========================================
            const popRatio = config.costs.villagers?.popRatio || 10;
            const maxVillagers = Math.floor(Math.max(config.costs.villagers?.baseVillagers || 2, settlement.population / popRatio));
            const activeVillagers = Object.values(state.agents).filter(a => a.type === 'Villager' && a.homeId === settlement.id).length;
            const totalVillagers = settlement.availableVillagers + activeVillagers;

            if (totalVillagers < maxVillagers) {
                // Food Safety
                const surviveThreshold = (settlement.population * config.costs.baseConsume) * (config.ai?.utility?.surviveThreshold || 15);
                const safetyFactor = config.ai?.utility?.growthFoodSafety || 1.0;
                const recruitCost = config.costs.agents.Villager.Food || 100;

                const safeFood = surviveThreshold * safetyFactor;
                let foodMultiplier = 0;
                if (settlement.stockpile.Food > (safeFood + recruitCost)) {
                    foodMultiplier = 1.0;
                } else if (settlement.stockpile.Food > recruitCost) {
                    foodMultiplier = 0.5;
                }

                const fulfillment = totalVillagers / maxVillagers;
                const growScore = (1.0 - fulfillment) * foodMultiplier;

                if (growScore > 0) {
                    actions.push({
                        type: 'RECRUIT_VILLAGER',
                        settlementId: settlement.id,
                        score: growScore
                    });
                }
            }
        });

        return actions;
    }
}
