import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export class VillagerStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

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
                const recruitCost = config.costs.villagers?.cost || 100;

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

            // ==========================================
            // DESIRE 1: SURVIVE (Food Security)
            // & DESIRE 3: PROVISION (Internal Logistics)
            // ==========================================

            const currentAvailable = settlement.availableVillagers;
            if (currentAvailable <= 0) return;

            // Calculate SURVIVE Score
            const surviveThreshold = (settlement.population * config.costs.baseConsume) * (config.ai?.utility?.surviveThreshold || 15);
            const foodRatio = settlement.stockpile.Food / (surviveThreshold || 1);
            // Critical Survival Bonus: If ratio < 0.5, boost score!
            let surviveScore = Math.max(0, 1.0 - foodRatio);
            if (foodRatio < 0.2) surviveScore *= 2.0; // Urgent!

            const range = config.costs.villagers?.range || 3;
            const jobs: { hexId: string, score: number, type: 'SURVIVE' | 'PROVISION' }[] = [];
            const centerHex = state.map[settlement.hexId];

            settlement.controlledHexIds.forEach(hexId => {
                const hex = state.map[hexId];
                if (!hex || !hex.resources) return;

                const dist = HexUtils.distance(centerHex.coordinate, hex.coordinate);
                if (dist > range) return;

                // SURVIVE: Only care about Food
                if (hex.resources.Food && hex.resources.Food > 0) {
                    const distPenalty = Math.max(1, dist * 0.5); // Ensure no div by zero, min 1
                    jobs.push({
                        hexId,
                        score: surviveScore / distPenalty,
                        type: 'SURVIVE'
                    });
                }

                // PROVISION: Care about Timber, Stone, Ore
                let provisionSum = 0;
                if (hex.resources.Timber) provisionSum += hex.resources.Timber;
                if (hex.resources.Stone) provisionSum += hex.resources.Stone;
                if (hex.resources.Ore) provisionSum += hex.resources.Ore;

                if (provisionSum > 0) {
                    const distMulti = config.ai?.utility?.provisionDistanceMulti || 10.0;
                    const provScore = provisionSum / (Math.max(1, dist) * distMulti);
                    jobs.push({
                        hexId,
                        score: provScore / 100.0,
                        type: 'PROVISION'
                    });
                }
            });

            // Sort jobs by score
            jobs.sort((a, b) => b.score - a.score);

            // Assign villagers to top jobs
            let localAvailable = currentAvailable;

            for (const job of jobs) {
                if (localAvailable <= 0) break;

                const assignedCount = Object.values(state.agents).filter(a =>
                    a.type === 'Villager' && a.mission === 'GATHER' && a.gatherTarget && HexUtils.getID(a.gatherTarget) === job.hexId
                ).length;

                const adjustedScore = job.score / (assignedCount + 1);

                if (adjustedScore > 0.1) {
                    actions.push({
                        type: 'DISPATCH_VILLAGER',
                        settlementId: settlement.id,
                        targetHexId: job.hexId,
                        score: adjustedScore
                    });
                    localAvailable--;
                }
            }
        });

        return actions;
    }
}
