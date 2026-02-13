import { WorldState, Settlement } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { Logger } from '../../utils/Logger';
import { SovereignAI } from './SovereignAI';
import { SettlementGovernor } from './SettlementGovernor';
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
}
