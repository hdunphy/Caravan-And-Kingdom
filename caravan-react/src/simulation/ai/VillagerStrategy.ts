import { AIAction, AIStrategy } from './AITypes';
import { WorldState, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export class VillagerStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(settlement => {
            // 1. Recruitment
            const villagerCost = config.costs.villagers?.cost || 100;
            const popRatio = config.costs.villagers?.popRatio || 10;
            const maxVillagers = Math.floor(Math.max(config.costs.villagers?.baseVillagers || 2, settlement.population / popRatio));
            const activeVillagers = Object.values(state.agents).filter(a => a.type === 'Villager' && a.homeId === settlement.id).length;
            const totalVillagers = settlement.availableVillagers + activeVillagers;
            const bufferMult = config.ai.thresholds.recruitBuffer || 2.0;
            const safeFood = config.ai.thresholds.surviveFood * bufferMult;

            if (totalVillagers < maxVillagers && settlement.stockpile.Food > (safeFood + villagerCost)) {
                actions.push({ type: 'RECRUIT_VILLAGER', settlementId: settlement.id });
            }

            // 2. Dispatch
            if (settlement.availableVillagers <= 0) return;

            const range = config.costs.villagers?.range || 3;
            const jobs: any[] = [];
            const centerHex = state.map[settlement.hexId];

            settlement.controlledHexIds.forEach(hexId => {
                if (hexId === settlement.hexId) return;
                const hex = state.map[hexId];
                if (!hex || !hex.resources) return;

                let weightedTotal = 0;
                const goal = settlement.currentGoal || 'TOOLS';

                for (const [res, amount] of Object.entries(hex.resources)) {
                    let weight = 1.0;
                    if (goal === 'SURVIVE' && res === 'Food') weight = 10.0;
                    if ((goal === 'UPGRADE' || goal === 'EXPAND') && (res === 'Timber' || res === 'Stone' || res === 'Ore')) weight = 5.0;
                    weightedTotal += (amount as number) * weight;
                }

                if (weightedTotal < 1) return;
                const dist = HexUtils.distance(centerHex.coordinate, hex.coordinate);
                if (dist > range) return;

                jobs.push({ hexId, score: weightedTotal / (dist || 1) });
            });

            jobs.sort((a, b) => b.score - a.score);

            for (const job of jobs) {
                if (settlement.availableVillagers <= 0) break;
                const assigned = Object.values(state.agents).filter(a =>
                    a.type === 'Villager' &&
                    a.homeId === settlement.id &&
                    a.mission === 'GATHER' &&
                    a.gatherTarget && HexUtils.getID(a.gatherTarget) === job.hexId
                ).length;

                const jobScoreMulti = config.ai.thresholds.villagerJobScoreMulti || 10;
                if (job.score > (assigned * jobScoreMulti)) {
                    actions.push({ type: 'DISPATCH_VILLAGER', settlementId: settlement.id, targetHexId: job.hexId });
                    // Manual decrement available to prevent double-assigning in same eval loop
                    settlement.availableVillagers--;
                }
            }
        });

        return actions;
    }
}
