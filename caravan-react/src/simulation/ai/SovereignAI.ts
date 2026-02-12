import { WorldState, Faction, Settlement, ResourceType, HexCell } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { Logger } from '../../utils/Logger';

export class SovereignAI {
    /**
     * Main evaluation loop for the Faction's Sovereign Mind.
     * Updates the FactionBlackboard with high-level strategic stances.
     */
    static evaluate(faction: Faction, state: WorldState, config: GameConfig): void {
        // Initialize Blackboard if missing
        if (!faction.blackboard) {
            faction.blackboard = {
                factionId: faction.id,
                stances: { expand: 0.0, exploit: 1.0 }, // Default to Exploit
                criticalShortages: [],
                targetedHexes: []
            };
        }

        const settlements = Object.values(state.settlements).filter(s => s.ownerId === faction.id);
        if (settlements.length === 0) return; // No settlements, nothing to govern

        // 1. Audit Resources (Scarcity Check)
        const criticalShortages = this.auditResources(settlements, state, config);
        faction.blackboard.criticalShortages = criticalShortages;

        // 2. Audit Stability (Food Security)
        const surplusRatio = this.auditStability(settlements, config);

        // 3. Decide Stance
        this.decideStance(faction, settlements.length, surplusRatio, criticalShortages, config);
    }

    private static auditResources(
        settlements: Settlement[],
        state: WorldState,
        config: GameConfig
    ): ResourceType[] {
        const shortages: ResourceType[] = [];
        const thresholds = config.ai.sovereign.scarcityThresholds;

        // Optimization: Aggregate controlled hexes from settlements instead of scanning the whole map
        const ownedHexes: HexCell[] = [];
        const seenHexIds = new Set<string>();

        settlements.forEach(s => {
            s.controlledHexIds.forEach(hexId => {
                if (!seenHexIds.has(hexId) && state.map[hexId]) {
                    seenHexIds.add(hexId);
                    ownedHexes.push(state.map[hexId]);
                }
            });
        });

        const totalOwned = ownedHexes.length;
        if (totalOwned === 0) return [];

        const resourceCounts: Record<string, number> = {
            Stone: 0,
            Ore: 0,
            Timber: 0,
            Food: 0
        };

        ownedHexes.forEach(hex => {
            const yields = config.yields[hex.terrain];
            if (yields) {
                if ((yields.Stone || 0) > 0) resourceCounts.Stone++;
                if ((yields.Ore || 0) > 0) resourceCounts.Ore++;
                if ((yields.Timber || 0) > 0) resourceCounts.Timber++;
                if ((yields.Food || 0) > 0) resourceCounts.Food++;
            }
        });

        (Object.keys(thresholds) as ResourceType[]).forEach(res => {
            const threshold = thresholds[res];
            if (threshold !== undefined && threshold > 0) {
                const count = resourceCounts[res] || 0;
                const ratio = count / totalOwned;
                if (ratio < threshold) {
                    shortages.push(res);
                }
            }
        });

        return shortages;
    }

    private static auditStability(settlements: Settlement[], config: GameConfig): number {
        // SurplusRatio = (Settlements with Food > SafeLevel) / Total_Settlements
        // SafeLevel = consumption * surviveTicks (from config)

        let stableCount = 0;
        const surviveTicks = config.ai.thresholds?.surviveTicks || 20;
        const baseConsume = config.costs.baseConsume || 0.1;

        settlements.forEach(s => {
            const consumption = Math.max(1, s.population * baseConsume);
            const safeLevel = consumption * surviveTicks;
            if (s.stockpile.Food >= safeLevel) {
                stableCount++;
            }
        });

        return stableCount / settlements.length;
    }

    private static decideStance(
        faction: Faction,
        settlementCount: number,
        surplusRatio: number,
        shortages: ResourceType[],
        config: GameConfig
    ): void {
        const bb = faction.blackboard!;
        const settlementCap = config.ai.settlementCap || 5;
        const foodSurplusReq = config.ai.sovereign.foodSurplusRatio || 0.8;
        const desperationReq = config.ai.sovereign.desperationFoodRatio || 0.5;

        // Base Expand Score Calculation (Sliding Scale)
        // Map surplusRatio from [desperationReq, foodSurplusReq] to [0.0, 1.0]
        // E.g. if 0.5 -> 0.0, if 0.8 -> 1.0
        let baseExpandScore = 0.0;
        if (surplusRatio >= foodSurplusReq) {
            baseExpandScore = 1.0;
        } else if (surplusRatio <= desperationReq) {
            baseExpandScore = 0.0;
        } else {
            // Linear interpolation
            baseExpandScore = (surplusRatio - desperationReq) / (foodSurplusReq - desperationReq);
        }

        // Apply Cap Penalty
        if (settlementCount >= settlementCap) {
            baseExpandScore *= config.ai.sovereign.capPenalty || 0.1;
        }

        // Critical Shortage Boost (Relative Value)
        // We boost the score if we are desperate for resources
        if (shortages.length > 0) {
            // If we have "enough" food to survive (above desperation), we boost expand
            if (surplusRatio >= desperationReq) {
                // Boost based on what we are missing
                let urgency = 0.0;
                const boosts = config.ai.sovereign.urgencyBoosts || {};

                shortages.forEach(res => {
                    if (boosts[res]) {
                        urgency += boosts[res]!;
                    }
                });

                // Clamp boost
                urgency = Math.min(1.0, urgency);

                // If we are at cap, we need MAJOR urgency to override
                if (settlementCount >= settlementCap) {
                    // Only override if urgency is high
                    const overrideMulti = config.ai.sovereign.capOverrideMultiplier || 1.5;
                    if (urgency > 0.5) baseExpandScore *= overrideMulti;
                } else {
                    // Normal boost
                    baseExpandScore = Math.min(1.0, baseExpandScore + urgency);
                }
            }
        }

        const oldExpand = bb.stances.expand;

        // Update Board
        bb.stances.expand = parseFloat(baseExpandScore.toFixed(2));
        bb.stances.exploit = parseFloat((1.0 - baseExpandScore).toFixed(2));

        // Logging significant shifts
        const shiftThreshold = config.ai.sovereign.stanceShiftThreshold || 0.3;
        if (Math.abs(bb.stances.expand - oldExpand) > shiftThreshold) {
            const mode = bb.stances.expand > 0.5 ? 'EXPAND' : 'EXPLOIT';
            const context = shortages.length > 0 ? `Shortages: ${shortages.join(', ')}` : 'Stability shift';
            Logger.getInstance().log(`[Sovereign] Faction ${faction.name} shift to ${mode} (${bb.stances.expand.toFixed(2)}): ${context}`);
        }
    }
}
