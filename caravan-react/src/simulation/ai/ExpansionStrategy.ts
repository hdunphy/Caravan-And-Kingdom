import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { MapGenerator } from '../MapGenerator';
import { HexUtils } from '../../utils/HexUtils';

export class ExpansionStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const faction = state.factions[factionId];
        if (!faction) return [];

        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);
        const cost = config.costs.settlement;
        const buffer = config.ai ? config.ai.expansionBuffer : 1.5;
        const cap = config.ai ? config.ai.settlementCap : 5;

        if (factionSettlements.length >= cap) return [];

        for (const settlement of factionSettlements) {
            // Affordability check
            if (settlement.stockpile.Food < (cost.Food || 0) * buffer ||
                settlement.stockpile.Timber < (cost.Timber || 0) * buffer) {
                continue;
            }

            // ==========================================
            // DESIRE 8: EXPAND (Strategic)
            // ==========================================

            const missing: string[] = [];
            if (settlement.stockpile.Stone < 50 && !settlement.controlledHexIds.some(h => state.map[h].terrain === 'Hills')) missing.push('Stone');
            if (settlement.stockpile.Ore < 50 && !settlement.controlledHexIds.some(h => state.map[h].terrain === 'Hills' || state.map[h].terrain === 'Mountains')) missing.push('Ore');

            const saturationScore = Math.pow(settlement.population / settlement.jobCap, config.ai?.utility?.expandSaturationPower || 3);

            // Strategic Scan
            if (missing.length > 0) {
                const radius = config.ai?.utility?.expandSearchRadius || 10;
                const minDistance = config.ai?.utility?.expandMinDistance || 5;
                let bestCandidate: any = null;
                let bestDist = 999;

                const allSettlements = Object.values(state.settlements); // All factions, or just ours? Usually strictly ALL to avoid overlap.

                Object.values(state.map).forEach(hex => {
                    if (hex.ownerId) return;

                    // Distance Check from ALL settlements
                    const tooClose = allSettlements.some(s => {
                        const sHex = state.map[s.hexId];
                        return sHex && HexUtils.distance(sHex.coordinate, hex.coordinate) < minDistance;
                    });

                    if (tooClose) return;

                    let provides = false;
                    // Simple terrain checks
                    if (missing.includes('Stone') && (hex.terrain === 'Hills' || hex.terrain === 'Mountains')) provides = true;
                    if (missing.includes('Ore') && (hex.terrain === 'Hills' || hex.terrain === 'Mountains')) provides = true;

                    if (provides) {
                        const dist = HexUtils.distance(state.map[settlement.hexId].coordinate, hex.coordinate);
                        if (dist <= radius && dist < bestDist) {
                            bestCandidate = hex;
                            bestDist = dist;
                        }
                    }
                });

                if (bestCandidate && bestCandidate.id) {
                    const dist = bestDist || 1;
                    const strategicScore = 1.0 / dist; // Closer is better for strategic satellite

                    const finalScore = Math.max(saturationScore, strategicScore);

                    actions.push({
                        type: 'SPAWN_SETTLER',
                        settlementId: settlement.id,
                        targetHexId: bestCandidate.id,
                        score: finalScore
                    });
                } else if (saturationScore > 0.5) {
                    const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
                    if (target) {
                        actions.push({
                            type: 'SPAWN_SETTLER',
                            settlementId: settlement.id,
                            targetHexId: target.id,
                            score: saturationScore
                        });
                    }
                }
            } else if (saturationScore > 0.5) {
                const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
                if (target) {
                    actions.push({
                        type: 'SPAWN_SETTLER',
                        settlementId: settlement.id,
                        targetHexId: target.id,
                        score: saturationScore
                    });
                }
            }
        }

        return actions;
    }
}
