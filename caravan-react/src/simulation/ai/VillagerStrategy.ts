import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export class VillagerStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string, settlementId?: string): AIAction[] {
        const actions: AIAction[] = [];
        let factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        if (settlementId) {
            factionSettlements = factionSettlements.filter(s => s.id === settlementId);
        }

        factionSettlements.forEach(settlement => {
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
                    // Reduce score based on satiation (surviveScore)
                    // If plenty of food, surviveScore is 0 -> Score 0 -> Villagers do other things

                    // Normalization: 
                    // 50 Food = 0.5 Base Score. 
                    // surviveScore is 0-2.0 multiplier.
                    // Result: 0 - 1.0+ (Can go higher for emergency)

                    const baseScore = Math.min(1.0, hex.resources.Food / 100.0);
                    jobs.push({ hexId: hexId, score: baseScore * surviveScore + 0.1, type: 'SURVIVE' }); // Base 0.1 to avoid 0
                }

                // PROVISION: Care about Timber, Stone, Ore
                let provisionSum = 0;
                if (hex.resources.Timber) provisionSum += hex.resources.Timber * (settlement.aiState?.focusResources.includes('Timber') ? 2.0 : 1.0);
                if (hex.resources.Stone) provisionSum += hex.resources.Stone * (settlement.aiState?.focusResources.includes('Stone') ? 2.0 : 1.0);
                if (hex.resources.Ore) provisionSum += hex.resources.Ore * (settlement.aiState?.focusResources.includes('Ore') ? 2.0 : 1.0);

                if (provisionSum > 0) {
                    const distMulti = config.ai?.utility?.provisionDistanceMulti || 10.0;
                    // Normalization:
                    // 100 resources at dist 1 = 1.0
                    // 100 resources at dist 5 = 0.2

                    const rawScore = provisionSum / (Math.max(1, dist) * distMulti);
                    // Explicitly clamp to 0-1, previously it was / 100.0 which was roughly correct but obscure
                    const provScore = Math.min(1.0, rawScore / 10.0); // Adjusted divisor to make 100res/1dist = 1.0

                    jobs.push({
                        hexId,
                        score: provScore,
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
