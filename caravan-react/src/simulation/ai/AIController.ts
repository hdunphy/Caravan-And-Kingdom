import { WorldState, Resources, Settlement } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { GoalEvaluator } from './GoalEvaluator.ts';
import { AIAction, AIStrategy } from './AITypes.ts';
import { ConstructionStrategy } from './ConstructionStrategy.ts';
import { LogisticsStrategy } from './LogisticsStrategy.ts';
import { ExpansionStrategy } from './ExpansionStrategy.ts';
import { TradeStrategy } from './TradeStrategy.ts';
import { ConstructionSystem } from '../systems/ConstructionSystem.ts';
import { CaravanSystem } from '../systems/CaravanSystem.ts';
import { VillagerSystem } from '../systems/VillagerSystem.ts';
import { UpgradeSystem } from '../systems/UpgradeSystem.ts';
import { RecruitStrategy } from './RecruitStrategy.ts';
import { UpgradeStrategy } from './UpgradeStrategy.ts';
import { Logger } from '../../utils/Logger';

export class AIController {
    private factionStates: Map<string, { lastTick: number, nextInterval: number }> = new Map();

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
            new LogisticsStrategy() // Internal Trade/Transport (Caravans only)
        ];

        this.tradeStrategies = [
            new TradeStrategy()
        ];
    }

    update(state: WorldState, config: GameConfig) {
        if (state.tick === 0) Logger.getInstance().log("AI UPDATING WITH SILENT=FALSE");

        const factionIds = Object.keys(state.factions);
        // Fisher-Yates shuffle for random order
        for (let i = factionIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [factionIds[i], factionIds[j]] = [factionIds[j], factionIds[i]];
        }

        factionIds.forEach(factionId => {

            // Initialize state if needed
            if (!this.factionStates.has(factionId)) {
                // Stagger initial start slightly (0-3 ticks)
                const stagger = Math.floor(Math.random() * 3);
                this.factionStates.set(factionId, {
                    lastTick: state.tick - 100 + stagger, // Force immediate first run
                    nextInterval: (config.ai ? config.ai.checkInterval : 10) + stagger
                });
            }

            const fState = this.factionStates.get(factionId)!;

            if (state.tick - fState.lastTick >= fState.nextInterval) {
                // Update Timing
                fState.lastTick = state.tick;
                const baseInterval = config.ai ? config.ai.checkInterval : 10;
                // +/- 3 ticks jitter
                const jitter = Math.floor(Math.random() * 7) - 3;
                fState.nextInterval = Math.max(1, baseInterval + jitter);

                // Execute Logic
                this.processFaction(factionId, state, config);
            }
        });
    }

    private processFaction(factionId: string, state: WorldState, config: GameConfig) {
        // 1. Update Settlement State & Influence Flags
        const settlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        settlements.forEach(s => {
            s.currentGoal = GoalEvaluator.evaluate(state, s, config);
            this.updateInfluenceFlags(s, config);
        });

        // 2. Evaluate & Execute per Settlement (simplifies grouping)
        settlements.forEach(s => {
            this.runGovernor(s, state, config, 'CIVIL', this.civilStrategies);
            this.runGovernor(s, state, config, 'LABOR', this.hrStrategies);     // New: Labor (Villagers)
            this.runGovernor(s, state, config, 'TRANSPORT', this.hrStrategies); // New: Transport (Logistics Caravans)
            this.runGovernor(s, state, config, 'TRADE', this.tradeStrategies);
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

        strategies.forEach(strategy => {
            actions.push(...strategy.evaluate(state, config, settlement.ownerId, settlement.id));
        });

        let relevantActions = actions.filter(a => a.settlementId === settlement.id);

        // Influence Checks
        if (settlement.aiState?.surviveMode) {
            // General Stand-Down: Block everything except HR (Food Gathering) and Critical Infrastructure (GathererHut)
            if (governorType === 'LABOR') {
                // Villagers allowed to Forage
            } else if (governorType === 'CIVIL') {
                // Only allow GathererHut
                relevantActions = relevantActions.filter(a => a.type === 'BUILD' && a.buildingType === 'GathererHut');
                if (relevantActions.length === 0) return;
            } else {
                return; // Trade/Transport blocked
            }
        }

        // Strict Role Filtering
        switch (governorType) {
            case 'CIVIL':
                relevantActions = relevantActions.filter(a =>
                    ['BUILD', 'UPGRADE_SETTLEMENT', 'SPAWN_SETTLER'].includes(a.type)
                );
                break;
            case 'LABOR':
                relevantActions = relevantActions.filter(a =>
                    ['RECRUIT_VILLAGER'].includes(a.type)
                );
                if (settlement.currentGoal === 'THRIFTY') {
                    relevantActions = relevantActions.filter(a => a.type !== 'RECRUIT_VILLAGER');
                }
                break;
            case 'TRANSPORT':
                relevantActions = relevantActions.filter(a =>
                    ['BUILD_CARAVAN'].includes(a.type) ||
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

        // Apply Decision Jitter
        // Add small random noise (0.00 to 0.05) to break ties or near-ties
        relevantActions.forEach(a => {
            a.score += (Math.random() * 0.05);
        });

        // Sort by Score
        relevantActions.sort((a, b) => b.score - a.score);

        // Track decision for UI
        if (!settlement.aiState) settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        // We'll store top 3 considerations
        if (!settlement.aiState.lastDecisions) settlement.aiState.lastDecisions = {};
        settlement.aiState.lastDecisions[governorType] = relevantActions.slice(0, 3).map(a => `${a.type}:${a.score.toFixed(2)}`); // Changed to 2 decimals due to jitter

        // Multi-Action Execution Loop
        for (const action of relevantActions) {
            const success = this.executeAction(state, config, action);
            if (success) {
                Logger.getInstance().log(`[AI] ${governorType} Governor executed ${action.type} for ${settlement.name}`);
            }
        }
    }

    private executeAction(state: WorldState, config: GameConfig, action: AIAction): boolean {
        switch (action.type) {
            case 'BUILD_CARAVAN':
                const cSettlement = state.settlements[action.settlementId];
                const cCost = config.costs.trade?.caravanTimberCost || 50;
                if (cSettlement.stockpile.Timber >= cCost) {
                    cSettlement.stockpile.Timber -= cCost;
                    CaravanSystem.spawn(state, cSettlement.hexId, cSettlement.hexId, 'Caravan', config); // Home to Home spawn
                    return true;
                }
                return false;
            case 'BUILD':
                return ConstructionSystem.build(state, action.settlementId, action.buildingType, action.buildingType === 'PavedRoad' || action.buildingType === 'Masonry' ? action.hexId : action.hexId, config); // Weird generic fix, just trusting hexId logic
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
                const sCost = config.costs.settlement;
                if (settlement.stockpile.Food < (sCost.Food || 0) || settlement.stockpile.Timber < (sCost.Timber || 0)) {
                    return false;
                }

                const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, 'Settler', config);
                if (agent) {
                    agent.ownerId = settlement.ownerId;
                    Object.entries(config.ai.expansionStarterPack).forEach(([res, amt]) => {
                        agent.cargo[res as keyof Resources] = amt as number;
                    });
                    // Costs handled by strategy/system verification usually, but deducting here for safety
                    settlement.stockpile.Food -= (sCost.Food || 0);
                    settlement.stockpile.Timber -= (sCost.Timber || 0);
                    settlement.population -= config.ai.settlerCost;

                    if (!settlement.aiState) settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
                    settlement.aiState.lastSettlerSpawnTick = state.tick;

                    Logger.getInstance().log(`[AI] Spawned Settler from ${settlement.name}`);
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
            case 'UPGRADE_SETTLEMENT':
                const settlementToUpgrade = state.settlements[action.settlementId];
                return UpgradeSystem.tryUpgrade(state, settlementToUpgrade, config);
        }
        return false;
    }
}
