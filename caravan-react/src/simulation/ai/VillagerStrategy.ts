import { AIAction, AIStrategy } from './AITypes';
import { WorldState, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';
import { Logger } from '../../utils/Logger';

export class VillagerStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string, settlementId?: string): AIAction[] {
        const actions: AIAction[] = [];
        const allFactionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);
        let factionSettlements = allFactionSettlements;

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

                // Role Bonus
                // "Settlements get a +25% utility score bonus for actions matching their role"
                // LUMBER -> Timber
                // MINING -> Stone/Ore
                // GRANARY -> Food (Handled in SURVIVE, but maybe here too for surplus?)

                const roleBonus = config.ai?.feudal?.roleUtilityBonus || 0.25;
                const isLumber = settlement.role === 'LUMBER';
                const isMining = settlement.role === 'MINING';

                let timberMult = settlement.aiState?.focusResources.includes('Timber') ? 2.0 : 1.0;
                if (isLumber) timberMult += roleBonus;

                let stoneMult = settlement.aiState?.focusResources.includes('Stone') ? 2.0 : 1.0;
                let oreMult = settlement.aiState?.focusResources.includes('Ore') ? 2.0 : 1.0;
                if (isMining) {
                    stoneMult += roleBonus;
                    oreMult += roleBonus;
                }

                if (hex.resources.Timber) {
                    const val = hex.resources.Timber * timberMult;
                    provisionSum += val;
                }
                if (hex.resources.Stone) provisionSum += hex.resources.Stone * stoneMult;
                if (hex.resources.Ore) provisionSum += hex.resources.Ore * oreMult;

                if (provisionSum > 0) {
                    const distMulti = config.ai?.utility?.provisionDistanceMulti || 10.0;
                    // Normalization:
                    // 100 resources at dist 1 = 1.0
                    // 100 resources at dist 5 = 0.2

                    // const rawScore = provisionSum / (Math.max(1, dist) * distMulti);
                    // Explicitly clamp to 0-1, previously it was / 100.0 which was roughly correct but obscure
                    const rawScore = provisionSum / (Math.max(1, dist) * distMulti);
                    const provScore = Math.min(1.0, rawScore / 10.0); // Adjusted divisor to make 100res/1dist = 1.0

                    Logger.getInstance().log(`[VillagerStrategy] Job ${hexId}: ProvSum=${provisionSum}, Dist=${dist}, DistMulti=${distMulti}, Raw=${rawScore}, Prov=${provScore}`);

                    jobs.push({
                        hexId,
                        score: provScore,
                        type: 'PROVISION'
                    });
                }
            });

            // ==========================================
            // INTERNAL LOGISTICS (Freight)
            // ==========================================
            if (settlement.tier >= 1) {
                const maxDist = config.ai?.feudal?.trade?.maxDistance || 10;
                const surplusThreshold = config.ai?.feudal?.trade?.surplusThreshold || 500;
                const deficitThreshold = config.ai?.feudal?.trade?.deficitThreshold || 100;

                const neighbors = allFactionSettlements.filter(s => s.id !== settlement.id && HexUtils.distance(centerHex.coordinate, state.map[s.hexId].coordinate) <= maxDist);

                neighbors.forEach(target => {
                    // Check all resources for potential trade
                    const resources: (keyof Resources)[] = ['Food', 'Timber', 'Stone', 'Ore', 'Tools', 'Gold'];

                    for (const res of resources) {
                        const myAmount = settlement.stockpile[res];
                        const theirAmount = target.stockpile[res];

                        // PUSH Logic: My Surplus -> Their Deficit
                        if (myAmount > surplusThreshold && theirAmount < deficitThreshold) {
                            // Calculate dynamic score based on their need?
                            // The lower their amount, the higher the need.
                            // 0 amount = 1.0 base score.
                            // deficitThreshold amount = 0.0 base score.

                            const needRatio = 1.0 - (theirAmount / deficitThreshold);
                            const tradeScore = 0.5 + (needRatio * 0.5); // 0.5 to 1.0 range

                            actions.push({
                                type: 'DISPATCH_VILLAGER',
                                settlementId: settlement.id,
                                targetHexId: target.hexId,
                                score: tradeScore,
                                mission: 'INTERNAL_FREIGHT',
                                payload: { resource: res, amount: 50 } // Config load capacity?
                            });
                        }
                    }
                });
            }

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
                    const action: AIAction = {
                        type: 'DISPATCH_VILLAGER',
                        settlementId: settlement.id,
                        targetHexId: job.hexId,
                        score: adjustedScore,
                        mission: 'GATHER'
                    };
                    Logger.getInstance().log(`[VillagerStrategy] Pushing action: ${JSON.stringify(action)}`);
                    actions.push(action);
                    localAvailable--;
                }
            }
        });

        return actions;
    }
}
