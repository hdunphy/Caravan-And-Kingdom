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

export class AIController {
    private lastUpdateTick: number = -100; // Force immediate update on first tick
    private strategies: AIStrategy[];

    constructor() {
        this.strategies = [
            new ConstructionStrategy(),
            new LogisticsStrategy(),
            new ExpansionStrategy(),
            new VillagerStrategy(),
            new TradeStrategy()
        ];
    }

    update(state: WorldState, config: GameConfig) {
        const interval = config.ai ? config.ai.checkInterval : 10;
        if (state.tick - this.lastUpdateTick < interval) return;
        this.lastUpdateTick = state.tick;

        Object.values(state.factions).forEach(faction => {
            // 1. Update Goals
            Object.values(state.settlements)
                .filter(s => s.ownerId === faction.id)
                .forEach(s => {
                    s.currentGoal = GoalEvaluator.evaluate(state, s, config);
                });

            // 2. Evaluate Strategies
            const actions: AIAction[] = [];
            this.strategies.forEach(strategy => {
                actions.push(...strategy.evaluate(state, config, faction.id));
            });

            // 3. Execute Actions
            this.executeActions(state, config, actions);
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
                        const settlement = state.settlements[action.settlementId];
                        const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, 'Settler');
                        if (agent) {
                            agent.ownerId = settlement.ownerId;
                            settlement.stockpile.Food -= (config.costs.settlement.Food || 0);
                            settlement.stockpile.Timber -= (config.costs.settlement.Timber || 0);
                            settlement.population -= config.ai.settlerCost;
                            const pack = config.ai.expansionStarterPack;
                            Object.entries(pack).forEach(([res, amt]) => { agent.cargo[res as keyof Resources] = amt as number; });
                        }
                    } else {
                        const settlement = state.settlements[action.settlementId];
                        CaravanSystem.dispatch(state, settlement, action.targetHexId, action.mission, config, action.context);
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
                    VillagerSystem.spawnVillager(state, action.settlementId, action.targetHexId);
                    break;
                case 'UPGRADE_SETTLEMENT':
                    const settlementToUpgrade = state.settlements[action.settlementId];
                    UpgradeSystem.tryUpgrade(state, settlementToUpgrade, config);
                    break;
            }
        });
    }
}
