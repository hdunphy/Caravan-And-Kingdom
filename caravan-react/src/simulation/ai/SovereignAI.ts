import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { MapGenerator } from '../MapGenerator';
import { CaravanSystem } from '../systems/CaravanSystem';

export class SovereignAI {
    static update(state: WorldState, faction: any, config: GameConfig) {
        // Limit expansion frequency
        const longInterval = config.ai ? config.ai.longCheckInterval : 50;
        if (state.tick % longInterval !== 0) return;

        // Iterate Settlements to find one capable of expansion
        Object.values(state.settlements).forEach(settlement => {
            if (settlement.ownerId !== faction.id) return;

            // Check Resources (Local Scope)
            const cost = config.costs.settlement;
            if (!cost) return;

            // Buffer: Use config value
            const buffer = config.ai ? config.ai.expansionBuffer : 1.5;
            if (settlement.stockpile.Food >= (cost.Food || 0) * buffer &&
                settlement.stockpile.Timber >= (cost.Timber || 0) * buffer) {

                // Cap expansion
                const cap = config.ai ? config.ai.settlementCap : 5;
                const settlementCount = Object.values(state.settlements).filter(s => s.ownerId === faction.id).length;
                if (settlementCount >= cap) return;

                // Find Target
                const existingSettlements = Object.values(state.settlements);
                const targetHex = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, existingSettlements);

                if (targetHex) {
                    // Spawn Settler
                    const agent = CaravanSystem.spawn(state, settlement.hexId, targetHex.id, 'Settler');
                    if (agent) {
                        agent.ownerId = faction.id;
                        // Deduct Cost
                        settlement.stockpile.Food -= (cost.Food || 0);
                        settlement.stockpile.Timber -= (cost.Timber || 0);
                        settlement.population -= config.ai.settlerCost;

                        // Load Cargo (Starter Pack)
                        agent.cargo.Food = 100;
                        agent.cargo.Timber = 50;
                        agent.cargo.Stone = 20;

                        console.log(`[AI] ${faction.name} sent a Settler from ${settlement.name} to ${targetHex.id}`);
                    }
                }
            }
        });
    }
}
