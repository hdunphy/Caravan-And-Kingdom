import { WorldState, Resources, Settlement } from '../../types/WorldTypes';
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
import { RecruitStrategy } from './RecruitStrategy';
import { UpgradeStrategy } from './UpgradeStrategy';

export class AIController {
    private lastUpdateTick: number = -100;

    // Governors
    private civilStrategies: AIStrategy[]; // Spending & Construction
    private hrStrategies: AIStrategy[];    // Workforce & Logistics
    private tradeStrategies: AIStrategy[]; // Commerce

    constructor() {
        this.civilStrategies = [
            new ConstructionStrategy(),
            new ExpansionStrategy(),
            new UpgradeStrategy(),
            new LogisticsStrategy(), // For BUILD_CARAVAN
            new RecruitStrategy(),   // For RECRUIT_VILLAGER
        ];

        this.hrStrategies = [
            new VillagerStrategy(), // Dispatch
            new LogisticsStrategy() // Internal Trade/Transport
        ];

        this.tradeStrategies = [
            new TradeStrategy()
        ];
    }

    update(state: WorldState, config: GameConfig) {
        const interval = config.ai ? config.ai.checkInterval : 10;
        if (state.tick - this.lastUpdateTick < interval) return;
        this.lastUpdateTick = state.tick;

        Object.values(state.factions).forEach(faction => {
            // 1. Update Settlement State & Influence Flags
            const settlements = Object.values(state.settlements).filter(s => s.ownerId === faction.id);

            settlements.forEach(s => {
                s.currentGoal = GoalEvaluator.evaluate(state, s, config);
                this.updateInfluenceFlags(s, config);
            });

            // 2. Evaluate & Execute per Settlement (simplifies grouping)
            settlements.forEach(s => {
                this.runGovernor(s, state, config, 'CIVIL', this.civilStrategies);
                this.runGovernor(s, state, config, 'HR', this.hrStrategies);
                this.runGovernor(s, state, config, 'TRADE', this.tradeStrategies);
            });
        });
    }

    private updateInfluenceFlags(settlement: Settlement, config: GameConfig) {
        if (!settlement.aiState) {
            settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        }

        // Check Survival Mode
        // If Food is critically low (< 20% capacity or < panicThreshold), explicit Panic Mode
        const food = settlement.stockpile.Food;
        const consumption = Math.max(5, settlement.population * (config.costs.baseConsume || 0.1));
        const panicThreshold = consumption * 5; // 5 ticks of food

        // OR if goal is explicitly SURVIVE
        settlement.aiState.surviveMode = settlement.currentGoal === 'SURVIVE' || food < panicThreshold;

        // Check Saving For Upgrade
        // If Goal is UPGRADE/ASCEND, verify if we are short on materials
        if (settlement.currentGoal === 'UPGRADE') {
            settlement.aiState.savingFor = 'UPGRADE';
            // Calculate specific resource gaps
            const nextTier = settlement.tier + 1;
            const upgradeCost = (nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity) as any;
            const missing: string[] = [];

            if (settlement.stockpile.Timber < (upgradeCost.costTimber || 0)) missing.push('Timber');
            if (settlement.stockpile.Stone < (upgradeCost.costStone || 0)) missing.push('Stone');
            if (settlement.stockpile.Ore < (upgradeCost.costOre || 0)) missing.push('Ore');

            settlement.aiState.focusResources = missing;
        } else if (settlement.currentGoal === 'EXPAND') {
            // Saving for Settler?
            settlement.aiState.savingFor = null;
        } else {
            settlement.aiState.savingFor = null;
        }
    }

    private runGovernor(settlement: Settlement, state: WorldState, config: GameConfig, governorType: string, strategies: AIStrategy[]) {
        const actions: AIAction[] = [];

        // Optimize: Pass settlementId to strategy to avoid evaluating all settlements
        strategies.forEach(strategy => {
            actions.push(...strategy.evaluate(state, config, settlement.ownerId, settlement.id));
        });

        // Filter for THIS settlement (Double check, though strategies should now filter)
        let relevantActions = actions.filter(a => a.settlementId === settlement.id);

        // Influence Checks
        if (settlement.aiState?.surviveMode) {
            // General Stand-Down: Block everything except HR (Food Gathering) and Critical Infrastructure (GathererHut)
            if (governorType === 'HR') {
                // Allowed
            } else if (governorType === 'CIVIL') {
                // Only allow GathererHut
                relevantActions = relevantActions.filter(a => a.type === 'BUILD' && a.buildingType === 'GathererHut');
                if (relevantActions.length === 0) return;
            } else {
                return; // Trade blocked
            }
        }

        // Strict Role Filtering
        switch (governorType) {
            case 'CIVIL':
                relevantActions = relevantActions.filter(a =>
                    ['BUILD', 'RECRUIT_VILLAGER', 'UPGRADE_SETTLEMENT', 'SPAWN_SETTLER', 'BUILD_CARAVAN'].includes(a.type)
                );
                break;
            case 'HR':
                relevantActions = relevantActions.filter(a =>
                    a.type === 'DISPATCH_VILLAGER' ||
                    (a.type === 'DISPATCH_CARAVAN' && a.mission === 'LOGISTICS')
                );
                break;
            case 'TRADE':
                relevantActions = relevantActions.filter(a =>
                    a.type === 'DISPATCH_CARAVAN' && a.mission === 'TRADE'
                );
                break;
        }

        if (relevantActions.length === 0) return;

        // Sort by Score
        relevantActions.sort((a, b) => b.score - a.score);

        // Track decision for UI
        if (!settlement.aiState) settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        // We'll store top 3 considerations
        if (!settlement.aiState.lastDecisions) settlement.aiState.lastDecisions = {};
        settlement.aiState.lastDecisions[governorType] = relevantActions.slice(0, 3).map(a => `${a.type}:${a.score.toFixed(1)}`);

        // Multi-Action Execution Loop
        for (const action of relevantActions) {
            this.executeAction(state, config, action);
            // If action failed (e.g. not enough resources), we continue to next
            // But we should be careful not to spam if costs aren't deducted immediately in executeAction
            // executeAction logic handles immediate resource deduction for most things?
            // RECRUIT: yes
            // SPAWN_SETTLER: yes
            // BUILD: ConstructionSystem checks cost. If we drain resources, subsequent builds fail.
            // DISPATCH_VILLAGER: Checks availableVillagers.
        }
    }

    private executeAction(state: WorldState, config: GameConfig, action: AIAction): boolean {
        switch (action.type) {
            case 'BUILD':
                return ConstructionSystem.build(state, action.settlementId, action.buildingType, action.hexId, config);
            case 'DISPATCH_CARAVAN':
                if (action.context?.type === 'Settler') {
                    // handled in SPAWN_SETTLER context usually, but just in case
                    return false;
                } else {
                    const settlement = state.settlements[action.settlementId];
                    // CaravanSystem.dispatch returns void, effectively always true if logic is sound? 
                    // We assume it succeeds if called.
                    CaravanSystem.dispatch(state, settlement, action.targetHexId, action.mission, config, action.context);
                    return true;
                }
            case 'SPAWN_SETTLER':
                const settlement = state.settlements[action.settlementId];
                const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, 'Settler', config);
                if (agent) {
                    agent.ownerId = settlement.ownerId;
                    Object.entries(config.ai.expansionStarterPack).forEach(([res, amt]) => {
                        agent.cargo[res as keyof Resources] = amt as number;
                    });
                    // Costs handled by strategy/system verification usually, but deducting here for safety
                    settlement.stockpile.Food -= (config.costs.settlement.Food || 0);
                    settlement.stockpile.Timber -= (config.costs.settlement.Timber || 0);
                    settlement.population -= config.ai.settlerCost;
                    console.log(`[AI] Spawned Settler from ${settlement.name}`);
                    return true;
                }
                return false;
            case 'RECRUIT_VILLAGER':
                // Logic from GovernorAI.manageVillagers
                const s = state.settlements[action.settlementId];
                const cost = config.costs.villagers.cost;
                if (s.stockpile.Food >= cost) {
                    s.stockpile.Food -= cost;
                    s.availableVillagers++;
                    return true;
                }
                return false;
            case 'DISPATCH_VILLAGER':
                // Check if villagers are available
                const vSettlement = state.settlements[action.settlementId];
                if (vSettlement.availableVillagers > 0) {
                    VillagerSystem.spawnVillager(state, action.settlementId, action.targetHexId, config);
                    return true;
                }
                return false;
            case 'UPGRADE_SETTLEMENT':
                const settlementToUpgrade = state.settlements[action.settlementId];
                return UpgradeSystem.tryUpgrade(state, settlementToUpgrade, config);
        }
        return false;
    }
}
