import { WorldState, Settlement, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { Logger } from '../../utils/Logger';
import { SovereignAI } from './SovereignAI';
import { SettlementGovernor } from './SettlementGovernor';
import { MapGenerator } from '../MapGenerator';
import { CaravanSystem } from '../systems/CaravanSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { GOAPPlanner } from './GOAPPlanner';
import { JobPool } from './JobPool';

export class AIController {
    private factionStates: Map<string, { lastTick: number, nextInterval: number }> = new Map();

    constructor() {
        // No legacy strategies needed
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
        GOAPPlanner.plan(faction, (faction as any).jobPool, state, config);

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
            this.updateInfluenceFlags(s, config);
        });

        // Resolve Instant Actions from Blackboard (Recruitment, Settlers)
        this.resolveInstantDesires(faction, state, config);
    }

    private updateInfluenceFlags(settlement: Settlement, config: GameConfig) {
        if (!settlement.aiState) {
            settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
        }

        // Check Survival Mode
        const food = settlement.stockpile.Food;
        const consumption = Math.max(5, settlement.population * (config.costs.baseConsume || 0.1));
        const panicThreshold = consumption * 5; // 5 ticks of food

        settlement.aiState.surviveMode = food < panicThreshold;
    }

    private resolveInstantDesires(faction: any, state: WorldState, config: GameConfig) {
        if (!faction.blackboard || !faction.blackboard.desires) return;

        const desires = faction.blackboard.desires;
        
        // Filter for instant actions and SORT by priority
        const instantDesires = desires
            .filter((d: any) =>
                d.type === 'RECRUIT_VILLAGER' ||
                d.type === 'SETTLER' ||
                d.type === 'UPGRADE' ||
                d.type === 'TRADE_CARAVAN' ||
                d.type.startsWith('BUILD_')
            )
            .sort((a: any, b: any) => b.score - a.score);

        // Process top 5 actions to ensure we don't skip high-prio recruits
        const topDesires = instantDesires.slice(0, 5);

        topDesires.forEach((d: any) => {
            const settlement = state.settlements[d.settlementId];
            if (!settlement) return;

            if (d.type === 'RECRUIT_VILLAGER') {
                const cost = config.costs.agents.Villager.Food || 100;
                if (settlement.stockpile.Food >= cost) {
                    settlement.stockpile.Food -= cost;
                    settlement.availableVillagers = (settlement.availableVillagers || 0) + 1;
                    // Logger.getInstance().log(`[AI] ${settlement.name} recruited villager.`);
                }
            } else if (d.type === 'SETTLER') {
                const sCost = config.costs.agents.Settler;
                if (settlement.stockpile.Food >= (sCost.Food || 0) && settlement.stockpile.Timber >= (sCost.Timber || 0)) {
                    const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
                    if (target) {
                        const agent = CaravanSystem.spawn(state, settlement.hexId, target.id, 'Settler', config);
                        if (agent) {
                            agent.ownerId = settlement.ownerId;
                            settlement.stockpile.Food -= (sCost.Food || 0);
                            settlement.stockpile.Timber -= (sCost.Timber || 0);
                            settlement.population -= config.ai.settlerCost;

                            if (faction.stats) faction.stats.settlersSpawned++;
                            Logger.getInstance().log(`[AI] ${settlement.name} spawned settler to ${target.id}`);
                        }
                    }
                }
            } else if (d.type === 'TRADE_CARAVAN') {
                const cCost = config.costs.agents.Caravan;
                if (settlement.stockpile.Timber >= (cCost.Timber || 50)) {
                    const agent = CaravanSystem.spawn(state, settlement.hexId, settlement.hexId, 'Caravan', config);
                    if (agent) {
                        agent.ownerId = settlement.ownerId;
                        (agent as any).homeId = settlement.id;
                        agent.status = 'IDLE';
                        settlement.stockpile.Timber -= (cCost.Timber || 50);
                        Logger.getInstance().log(`[AI] ${settlement.name} recruited Caravan.`);
                    }
                }
            } else if (d.type === 'UPGRADE') {
                const success = UpgradeSystem.tryUpgrade(state, settlement, config);
                if (success) {
                    Logger.getInstance().log(`[AI] ${settlement.id} upgraded to Tier ${settlement.tier}`);
                }
            } else if (d.type.startsWith('BUILD_')) {
                const rawType = d.type.replace('BUILD_', '');
                const buildingType = this.toTitleCase(rawType);
                if (!settlement.buildings.some((b: any) => b.type === buildingType)) {
                    const cost = this.getBuildingCost(rawType, config);
                    let canAfford = true;
                    for (const [res, amt] of Object.entries(cost)) {
                        if ((settlement.stockpile[res as keyof Resources] || 0) < (amt as number)) canAfford = false;
                    }
                    if (canAfford) {
                        for (const [res, amt] of Object.entries(cost)) settlement.stockpile[res as keyof Resources] -= (amt as number);
                        settlement.buildings.push({
                            id: `bld_${Date.now()}`, type: buildingType as any, hexId: settlement.hexId, integrity: 100, level: 1
                        });
                        Logger.getInstance().log(`[AI] ${settlement.id} constructed ${buildingType}`);
                    }
                }
            }
        });
    }

    private getBuildingCost(type: string, config: GameConfig): Partial<Resources> {
        switch (type) {
            case 'SMITHY':
                return config.buildings['Smithy']?.cost || { Stone: 150, Ore: 50 };
            case 'GRANARY':
                return { Timber: 100, Stone: 20 };
            case 'FISHERY':
                return config.buildings['Fishery']?.cost || { Timber: 100 };
            case 'LUMBERYARD':
                return config.buildings['Sawmill']?.cost || { Timber: 50 };
            case 'MINE':
                return config.buildings['Masonry']?.cost || { Stone: 50 };
            default: return { Timber: 50 };
        }
    }

    private toTitleCase(str: string): string {
        if (str === 'GRANARY') return 'Granary';
        if (str === 'FISHERY') return 'Fishery';
        if (str === 'SMITHY') return 'Smithy';
        if (str === 'LUMBERYARD') return 'LumberYard';
        if (str === 'MINE') return 'Mine';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
}
