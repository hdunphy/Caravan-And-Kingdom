import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class LogisticsStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(settlement => {
            const threshold = config.costs.logistics?.freightThreshold || 40;

            settlement.controlledHexIds.forEach(hexId => {
                if (hexId === settlement.hexId) return;

                const hex = state.map[hexId];
                if (hex && hex.resources) {
                    const totalResources = (Object.values(hex.resources) as number[]).reduce((a, b) => a + b, 0);

                    if (totalResources >= threshold) {
                        const existing = Object.values(state.agents).find(agent =>
                            agent.type === 'Caravan' &&
                            agent.ownerId === settlement.ownerId &&
                            agent.mission === 'LOGISTICS' &&
                            ((agent.target && hex.coordinate.q === agent.target.q && hex.coordinate.r === agent.target.r) ||
                                (agent.tradeState === 'OUTBOUND' && agent.activity === 'LOADING'))
                        );

                        if (!existing) {
                            actions.push({
                                type: 'DISPATCH_CARAVAN',
                                settlementId: settlement.id,
                                targetHexId: hexId,
                                mission: 'LOGISTICS',
                                context: {}
                            });
                        }
                    }
                }
            });
        });

        return actions;
    }
}
