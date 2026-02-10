import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { MapGenerator } from '../MapGenerator';

export class ExpansionStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const faction = state.factions[factionId];
        if (!faction) return [];

        // Limit expansion frequency (Throttled by controller tick)
        // SovereignAI logic: checkResources -> findTarget -> Spawn Settler

        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);
        const cost = config.costs.settlement;
        const buffer = config.ai ? config.ai.expansionBuffer : 1.5;
        const cap = config.ai ? config.ai.settlementCap : 5;

        if (factionSettlements.length >= cap) return [];

        for (const settlement of factionSettlements) {
            if (settlement.stockpile.Food >= (cost.Food || 0) * buffer &&
                settlement.stockpile.Timber >= (cost.Timber || 0) * buffer) {

                const existingSettlements = Object.values(state.settlements);
                const targetHex = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, existingSettlements);

                if (targetHex) {
                    actions.push({
                        type: 'DISPATCH_CARAVAN',
                        settlementId: settlement.id,
                        targetHexId: targetHex.id,
                        mission: 'LOGISTICS', // Settler missions use special mission type or just LOGISTICS + context?
                        // Original SovereignAI uses CaravanSystem.spawn(..., 'Settler')
                        // Let's refine the action to allow specific type
                        context: { type: 'Settler' }
                    });
                    break; // One settler at a time per faction?
                }
            }
        }

        return actions;
    }
}
