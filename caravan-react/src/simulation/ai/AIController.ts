import { WorldState, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { GoalEvaluator } from './GoalEvaluator';
import { AIAction, AIStrategy } from './AITypes';
import { ConstructionStrategy } from './ConstructionStrategy';
import { LogisticsStrategy } from './LogisticsStrategy';
import { ExpansionStrategy } from './ExpansionStrategy';
import { VillagerStrategy } from './VillagerStrategy';
import { TradeStrategy } from './TradeStrategy';
import { ConstructionSystem } from '../systems/ConstructionSystem';
import { CaravanSystem } from '../systems/CaravanSystem';
import { VillagerSystem } from '../systems/VillagerSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';

import { UpgradeStrategy } from './UpgradeStrategy';

export class AIController {
    private lastUpdateTick: number = -100; // Force immediate update on first tick
    private strategies: AIStrategy[];

    constructor() {
        this.strategies = [
            new ConstructionStrategy(),
            new LogisticsStrategy(),
            new ExpansionStrategy(),
            new VillagerStrategy(),
            new TradeStrategy(),
            new UpgradeStrategy()
        ];
    }

    update(state: WorldState, config: GameConfig) {
        const interval = config.ai ? config.ai.checkInterval : 10;
        if (state.tick - this.lastUpdateTick < interval) return;
        this.lastUpdateTick = state.tick;

        Object.values(state.factions).forEach(faction => {
            // 1. Update Goals (Should be deprecated by new Utility system, but keep for legacy/monitoring?)
            Object.values(state.settlements)
                .filter(s => s.ownerId === faction.id)
                .forEach(s => {
                    s.currentGoal = GoalEvaluator.evaluate(state, s, config);
                });

            // 2. Evaluate Strategies (Gather all desires)
            const actions: AIAction[] = [];
            this.strategies.forEach(strategy => {
                actions.push(...strategy.evaluate(state, config, faction.id));
            });

            // 3. The Winner Logic: Group by Settlement and Pick Best
            // Filter actions for this faction (strategies already filtered, but safest to be sure)
            // Group by settlementId
            const settlementActions: Record<string, AIAction[]> = {};
            actions.forEach(a => {
                if (!settlementActions[a.settlementId]) settlementActions[a.settlementId] = [];
                settlementActions[a.settlementId].push(a);
            });

            const topActions: AIAction[] = [];
            Object.values(settlementActions).forEach(saa => {
                // Sort by score descending
                saa.sort((a, b) => b.score - a.score);

                // Pick top 1 (or top N?)
                // If we pick top 1, we ensure focus.
                if (saa.length > 0) {
                    topActions.push(saa[0]);
                }
            });

            // 4. Execute Actions
            this.executeActions(state, config, topActions);
        });
    }

    private executeActions(state: WorldState, config: GameConfig, actions: AIAction[]) {
        actions.forEach(action => {
            switch (action.type) {
                case 'BUILD':
                    ConstructionSystem.build(state, action.settlementId, action.buildingType, action.hexId, config);
                    break;
                case 'DISPATCH_CARAVAN':
                    if (action.context.type === 'Settler') {
                        // Legacy support if needed, but we used SPAWN_SETTLER
                    } else {
                        const settlement = state.settlements[action.settlementId];
                        CaravanSystem.dispatch(state, settlement, action.targetHexId, action.mission, config, action.context);
                    }
                    break;
                case 'SPAWN_SETTLER':
                    // Spawn logic handled by CaravanSystem, but costs handled here for now.
                    // Future: Move cost logic to System?
                    const settlement = state.settlements[action.settlementId];
                    const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, 'Settler', config);
                    if (agent) {
                        agent.ownerId = settlement.ownerId;
                        // Deduct costs
                        settlement.stockpile.Food -= (config.costs.settlement.Food || 0);
                        settlement.stockpile.Timber -= (config.costs.settlement.Timber || 0);
                        settlement.population -= config.ai.settlerCost;

                        // Grant Starter Pack
                        const pack = config.ai.expansionStarterPack;
                        Object.entries(pack).forEach(([res, amt]) => { agent.cargo[res as keyof Resources] = amt as number; });

                        console.log(`[AI] Spawned Settler from ${settlement.name}`);
                    }
                    break;
                case 'BUILD_CARAVAN':
                    // Need to implement BUILD_CARAVAN logic if not exists.
                    // Assuming we treat it like spawning a caravan agent at home.
                    const s2 = state.settlements[action.settlementId];
                    if (s2.stockpile.Timber >= (config.costs.trade?.caravanTimberCost || 50)) {
                        s2.stockpile.Timber -= (config.costs.trade?.caravanTimberCost || 50);
                        const c = CaravanSystem.spawn(state, s2.hexId, s2.hexId, 'Caravan', config);
                        if (c && c.type === 'Caravan') {
                            c.ownerId = s2.ownerId;
                            c.homeId = s2.id;
                        }
                    }
                    break;
                case 'RECRUIT_VILLAGER':
                    // Logic from GovernorAI.manageVillagers
                    const s = state.settlements[action.settlementId];
                    const cost = config.costs.villagers.cost;
                    s.stockpile.Food -= cost;
                    s.availableVillagers++;
                    break;
                case 'DISPATCH_VILLAGER':
                    VillagerSystem.spawnVillager(state, action.settlementId, action.targetHexId, config);
                    break;
                case 'UPGRADE_SETTLEMENT':
                    const settlementToUpgrade = state.settlements[action.settlementId];
                    UpgradeSystem.tryUpgrade(state, settlementToUpgrade, config);
                    break;
            }
        });
    }
}
