import { WorldState, Resources, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { AIAction, AIStrategy } from './AITypes';
import { ConstructionStrategy } from './ConstructionStrategy';
import { LogisticsStrategy } from './LogisticsStrategy';
import { ExpansionStrategy } from './ExpansionStrategy';
import { TradeStrategy } from './TradeStrategy';
import { ConstructionSystem } from '../systems/ConstructionSystem';
import { CaravanSystem } from '../systems/CaravanSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { RecruitStrategy } from './RecruitStrategy';
import { UpgradeStrategy } from './UpgradeStrategy';
import { Logger } from '../../utils/Logger';
import { SovereignAI } from './SovereignAI';
import { SettlementGovernor } from './SettlementGovernor';
import { GOAPPlanner } from './GOAPPlanner';
import { JobPool } from './JobPool';

export class AIController {
    private factionStates: Map<string, { lastTick: number, nextInterval: number }> = new Map();

    // Governors
    private civilStrategies: AIStrategy[]; // Spending & Construction
    private hrStrategies: AIStrategy[];    // Workforce & Logistics
    private tradeStrategies: AIStrategy[]; // Commerce

    constructor() {
        this.civilStrategies = [
            new ConstructionStrategy(),
            new UpgradeStrategy(),
        ];

        this.hrStrategies = [
            new RecruitStrategy(),
            new ExpansionStrategy(),
            new LogisticsStrategy()
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

    private processFaction(factionId: string, state: WorldState, globalConfig: GameConfig) {
        const faction = state.factions[factionId];
        if (!faction) return;

        // Use Faction-Specific AI Config if available (for Gladiator GA)
        const config = (faction as any).aiConfig || globalConfig;

        // 0. Sovereign Check (Faction Level)
        SovereignAI.evaluate(faction, state, config);

        // MILESTONE 3: GOAP Planner
        if (!(faction as any).jobPool) {
            (faction as any).jobPool = new JobPool(faction.id);
        }
        GOAPPlanner.plan(faction, (faction as any).jobPool, config);

        // 1. Update Settlement State & Influence Flags
        const settlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        // MILESTONE 2: Governor & Blackboard Integration
        // Clear old desires
        if (faction.blackboard) {
            (faction.blackboard as any).desires = [];
        }

        settlements.forEach(s => {
            // Run Governor -> Posts Desires to Blackboard
            SettlementGovernor.evaluate(s, faction, state, config);

            // Bridge: Map Top Desire to Legacy Goal (for compat with existing strategies)
            if (faction.blackboard && (faction.blackboard as any).desires) {
                const myDesires = (faction.blackboard as any).desires
                    .filter((d: any) => d.settlementId === s.id)
                    .sort((a: any, b: any) => b.score - a.score);

                if (myDesires.length > 0) {
                    const topDesire = myDesires[0];
                    switch (topDesire.type) {
                        case 'UPGRADE': s.currentGoal = 'UPGRADE'; break;
                        case 'SETTLER': s.currentGoal = 'EXPAND'; break;
                        case 'BUILD_SMITHY': s.currentGoal = 'TOOLS'; break;
                        case 'RECRUIT_VILLAGER': s.currentGoal = 'EXPAND'; break;
                        default: s.currentGoal = undefined; break;
                    }
                } else {
                    s.currentGoal = undefined;
                }
            }

            this.updateInfluenceFlags(s, config);
        });

        // 2. Evaluate & Execute per Settlement
        settlements.forEach(s => {
            this.runGovernor(s, state, config, 'CIVIL', this.civilStrategies);
            this.runGovernor(s, state, config, 'LABOR', this.hrStrategies);
            this.runGovernor(s, state, config, 'TRANSPORT', this.hrStrategies);
            this.runGovernor(s, state, config, 'TRADE', this.tradeStrategies);
        });
    }

    private updateInfluenceFlags(settlement: Settlement, config: GameConfig) {
        if (!settlement.aiState) {
            settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        }

        // Check Survival Mode
        const food = settlement.stockpile.Food;
        const consumption = Math.max(5, settlement.population * (config.costs.baseConsume || 0.1));
        const panicThreshold = consumption * 5; // 5 ticks of food

        // OR if goal is explicitly SURVIVE (e.g. from Desire override if we had one)
        settlement.aiState.surviveMode = settlement.currentGoal === 'SURVIVE' || food < panicThreshold;

        // Check Saving For Upgrade
        if (settlement.currentGoal === 'UPGRADE') {
            settlement.aiState.savingFor = 'UPGRADE';
            const nextTier = settlement.tier + 1;
            const upgradeCost = (nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity) as any;
            const missing: string[] = [];

            if (settlement.stockpile.Timber < (upgradeCost.costTimber || 0)) missing.push('Timber');
            if (settlement.stockpile.Stone < (upgradeCost.costStone || 0)) missing.push('Stone');
            if (settlement.stockpile.Ore < (upgradeCost.costOre || 0)) missing.push('Ore');

            settlement.aiState.focusResources = missing;
        } else if (settlement.currentGoal === 'EXPAND') {
            settlement.aiState.savingFor = null;
        } else {
            settlement.aiState.savingFor = null;
        }
    }

    private runGovernor(settlement: Settlement, state: WorldState, config: GameConfig, governorType: string, strategies: AIStrategy[]) {
        const actions: AIAction[] = [];

        strategies.forEach(strategy => {
            const evaluated = strategy.evaluate(state, config, settlement.ownerId, settlement.id);
            actions.push(...evaluated);
        });

        let relevantActions = actions.filter(a => a.settlementId === settlement.id);

        if (settlement.aiState?.surviveMode) {
            if (governorType === 'LABOR') {
                // Allowed
            } else if (governorType === 'CIVIL') {
                relevantActions = relevantActions.filter(a => a.type === 'BUILD' && a.buildingType === 'GathererHut');
                if (relevantActions.length === 0) return;
            } else {
                return;
            }
        }

        switch (governorType) {
            case 'CIVIL':
                relevantActions = relevantActions.filter(a =>
                    ['BUILD', 'UPGRADE_SETTLEMENT', 'SPAWN_SETTLER'].includes(a.type)
                );
                break;
            case 'LABOR':
                relevantActions = relevantActions.filter(a =>
                    ['RECRUIT_VILLAGER', 'SPAWN_SETTLER', 'DISPATCH_VILLAGER'].includes(a.type)
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

        relevantActions.forEach(a => {
            a.score += (Math.random() * 0.05);
        });

        relevantActions.sort((a, b) => b.score - a.score);

        if (!settlement.aiState) settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        if (!settlement.aiState.lastDecisions) settlement.aiState.lastDecisions = {};
        settlement.aiState.lastDecisions[governorType] = relevantActions.slice(0, 3).map(a => `${a.type}:${a.score.toFixed(2)}`);

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
                const cCost = config.costs.agents.Caravan.Timber || 50;
                if (cSettlement.stockpile.Timber >= cCost) {
                    cSettlement.stockpile.Timber -= cCost;
                    CaravanSystem.spawn(state, cSettlement.hexId, cSettlement.hexId, 'Caravan', config);
                    return true;
                }
                return false;
            case 'BUILD':
                if (!action.buildingType || !action.targetHexId) return false;
                // Fix: AIAction now uses targetHexId, pass it to build system
                return ConstructionSystem.build(state, action.settlementId, action.buildingType, action.targetHexId, config);
            case 'DISPATCH_CARAVAN':
                if (action.context?.type === 'Settler') {
                    return false;
                } else {
                    const settlement = state.settlements[action.settlementId];
                    if (!action.targetHexId || !action.mission) return false;

                    if (action.mission === 'TRADE' || action.mission === 'LOGISTICS') {
                        CaravanSystem.dispatch(state, settlement, action.targetHexId, action.mission, config, action.context);
                        return true;
                    }
                    return false;
                }
            case 'SPAWN_SETTLER':
                const settlement = state.settlements[action.settlementId];
                const sCost = config.costs.agents.Settler;
                if (settlement.stockpile.Food < (sCost.Food || 0) || settlement.stockpile.Timber < (sCost.Timber || 0)) {
                    return false;
                }
                if (!action.targetHexId) return false;

                const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, 'Settler', config);
                if (agent) {
                    agent.ownerId = settlement.ownerId;
                    Object.entries(config.ai.expansionStarterPack).forEach(([res, amt]) => {
                        agent.cargo[res as keyof Resources] = amt as number;
                    });
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
                const s = state.settlements[action.settlementId];
                const cost = config.costs.agents.Villager.Food || 100;
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
