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
        // Filter for instant actions
        const instantDesires = desires.filter((d: any) =>
            d.type === 'RECRUIT_VILLAGER' ||
            d.type === 'SETTLER' ||
            d.type === 'UPGRADE' ||
            d.type.startsWith('BUILD_')
        );

        instantDesires.forEach((d: any) => {
            const settlement = state.settlements[d.settlementId];
            if (!settlement) return;

            if (d.type === 'RECRUIT_VILLAGER') {
                const cost = config.costs.agents.Villager.Food || 100;
                if (settlement.stockpile.Food >= cost) {
                    settlement.stockpile.Food -= cost;
                    settlement.availableVillagers = (settlement.availableVillagers || 0) + 1;
                    Logger.getInstance().log(`[AI] ${settlement.id} recruited villager. Pop: ${settlement.population}`);
                }
            } else if (d.type === 'SETTLER') {
                const sCost = config.costs.agents.Settler;
                if (settlement.stockpile.Food >= (sCost.Food || 0) && settlement.stockpile.Timber >= (sCost.Timber || 0)) {
                    // Find expansion target (simplified for instant resolution or dispatch)
                    const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
                    if (target) {
                        const agent = CaravanSystem.spawn(state, settlement.hexId, target.id, 'Settler', config);
                        if (agent) {
                            agent.ownerId = settlement.ownerId;
                            // Deduct Costs
                            settlement.stockpile.Food -= (sCost.Food || 0);
                            settlement.stockpile.Timber -= (sCost.Timber || 0);
                            settlement.population -= config.ai.settlerCost;

                            // Increment Stats
                            if (faction && faction.stats) {
                                faction.stats.settlersSpawned++;
                            }
                            Logger.getInstance().log(`[AI] ${settlement.id} spawned settler to ${target.id}`);
                        }
                    }
                }
            } else if (d.type.startsWith('BUILD_')) {
                const buildingType = d.type.replace('BUILD_', '');
                // Check if already built (to avoid duplicates if desire persists)
                if (settlement.buildings.includes(buildingType)) return;

                const cost = this.getBuildingCost(buildingType, config);
                let canAfford = true;
                const missing: string[] = [];

                for (const [res, amount] of Object.entries(cost)) {
                    if ((settlement.stockpile[res as keyof Resources] || 0) < (amount as number)) {
                        canAfford = false;
                        missing.push(`${res} (${(settlement.stockpile[res as keyof Resources] || 0)}/${amount})`);
                    }
                }

                if (canAfford) {
                    // Deduct
                    for (const [res, amount] of Object.entries(cost)) {
                        settlement.stockpile[res as keyof Resources] -= (amount as number);
                    }
                    // Build
                    settlement.buildings.push(buildingType);
                    Logger.getInstance().log(`[AI] ${settlement.id} constructed ${buildingType}`);

                    // Stats
                    if (faction.stats) faction.stats.buildingsConstructed = (faction.stats.buildingsConstructed || 0) + 1;
                } else {
                    // Log failure reason (Standard log for now to see it)
                    // Only log intermittently or if specifically debugged? 
                    // Let's log if score is high (> 0.5) to avoid spam for low prio
                    if (d.score > 0.5) {
                        Logger.getInstance().log(`[AI] ${settlement.id} wanted ${buildingType} but missing: ${missing.join(', ')}`);
                    }
                }
            } else if (d.type === 'UPGRADE') {
                // Attempt upgrade via System
                // UpgradeSystem checks costs and population requirements internally
                const success = UpgradeSystem.tryUpgrade(state, settlement, config);
                if (success) {
                    Logger.getInstance().log(`[AI] ${settlement.id} upgraded to Tier ${settlement.tier}`);
                }
            }
        });
    }

    private getBuildingCost(type: string, config: GameConfig): Partial<Resources> {
        // Map UPPERCASE Desire type to Config Key (Title Case)
        // e.g. SMITHY -> Smithy, GRANARY -> Granary (Mapped manually or via lookup)
        // Simple map for now based on known types
        // If type === 'SMITHY', configKey = 'Smithy';
        // If type === 'GRANARY', configKey = 'Granary'; // Not in config? 'Warehouse' is logic equivalent? No, Wait.
        // Governor uses 'BUILD_GRANARY'. Config key?
        // Let's create a switch that maps to Config, or fallback to defaults.

        // Actually, let's look at GameConfig (Step 330).
        // It has 'Smithy', 'Fishery', 'Watchtower', 'GuardPost', 'PavedRoad', 'Masonry', 'Sawmill', 'Warehouse', 'GathererHut'.
        // Governor asks for: SMITHY, GRANARY, FISHERY, LUMBERYARD, MINE.
        // Mismatch!

        switch (type) {
            case 'SMITHY':
                return config.buildings['Smithy']?.cost || { Stone: 150, Ore: 50 };
            case 'GRANARY':
                // Using Warehouse as Granary equivalent or fallback? 
                // Governor asks for Granary. Config has Warehouse.
                // Let's assume Granary cost triggers building of... what?
                // If we construct "GRANARY", verification expects "GRANARY". 
                // Let's stick to the requested Type for now, but use generic costs.
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
}
