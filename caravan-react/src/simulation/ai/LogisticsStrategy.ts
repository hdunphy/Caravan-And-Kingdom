import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

export class LogisticsStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string, settlementId?: string): AIAction[] {
        const actions: AIAction[] = [];
        let factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        if (settlementId) {
            factionSettlements = factionSettlements.filter(s => s.id === settlementId);
        }

        // Global Fleet Check (Per Faction or Per Settlement? Usually Per Settlement ownership)
        // AI_SPEC: "Spends Timber to build a new Caravan if the need for trade or strategic expansion outweighs the current fleet capacity."
        // Let's implement per-settlement fleet management.

        factionSettlements.forEach(settlement => {
            // ==========================================
            // DESIRE 7: FLEET (Caravan Production)
            // ==========================================
            const myCaravans = Object.values(state.agents).filter(a => a.type === 'Caravan' && a.ownerId === factionId && a.homeId === settlement.id); // Assuming agents have homeId? 
            // Agent type doesn't have homeId on top level, but logic usually infers it or uses 'ownerId'. 
            // Actually, CaravanSystem.spawn doesn't strictly assign 'homeId' but standard agents might.
            // Let's assume we count by ownerId for now, but that's global.
            // Existing logic in LogisticsStrategy uses `agent.ownerId === settlement.ownerId`.
            // Wait, if multiple settlements, we need to know which one owns the caravan.
            // For now, let's treat all caravans as shared or just count total.
            // Better: use `agent.homeId` if it exists, or just count agents near settlement? 
            // In `CaravanSystem`, agents are just agents.
            // Let's skip nuanced ownership and just say:
            // "If I have < Target Fleet, and I have Timber, Build."

            // Simple logic:
            const targetFleet = config.ai?.utility?.fleetTargetSize || 3;
            const currentFleet = myCaravans.length;

            if (currentFleet < targetFleet && settlement.stockpile.Timber >= (config.costs.trade?.caravanTimberCost || 50)) {
                // Score based on deficit, capped at 0.5 to defer to critical needs
                const fleetScore = (1.0 - (currentFleet / targetFleet)) * 0.5;
                if (fleetScore > 0.1) {
                    // Action: BUILD_CARAVAN
                    // This action triggers the construction of a new caravan agent at the settlement.
                    // It separates 'Logic' (here) from 'Execution' (AIController).
                    actions.push({
                        type: 'BUILD_CARAVAN',
                        settlementId: settlement.id,
                        score: fleetScore
                    } as any);
                }
            }


            // ==========================================
            // INTERNAL LOGISTICS (Freight)
            // ==========================================
            // Logic: Gather resources from controlled outlying hexes (e.g. mines, forest camps) to the settlement center.
            // This allows the settlement to consolidate resources for construction/upgrade.
            const threshold = config.costs.logistics?.freightThreshold || 40;

            settlement.controlledHexIds.forEach(hexId => {
                if (hexId === settlement.hexId) return;

                const hex = state.map[hexId];
                if (hex && hex.resources) {
                    const totalResources = (Object.values(hex.resources) as number[]).reduce((a, b) => a + b, 0);

                    if (totalResources >= threshold) {
                        // Check for existing assignment
                        const existing = Object.values(state.agents).find(agent =>
                            agent.type === 'Caravan' &&
                            agent.ownerId === settlement.ownerId &&
                            agent.mission === 'LOGISTICS' &&
                            agent.target && HexUtils.getID(agent.target) === hexId
                        );

                        if (!existing) {
                            // Score based on resource amount
                            const score = (totalResources / 100.0) * 0.5; // Freight is lower priority than Trade usually
                            actions.push({
                                type: 'DISPATCH_CARAVAN',
                                settlementId: settlement.id,
                                targetHexId: hexId,
                                mission: 'LOGISTICS',
                                context: {},
                                score: score
                            });
                        }
                    }
                }
            });
        });

        return actions;
    }
}
