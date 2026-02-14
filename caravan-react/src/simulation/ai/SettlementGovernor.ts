import { Settlement, Faction, WorldState, DesireTicket, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class SettlementGovernor {
    /**
     * Evaluates local needs and Sovereign stance to generate weighted DesireTickets.
     */
    static evaluate(
        settlement: Settlement,
        faction: Faction,
        state: WorldState,
        config: GameConfig
    ): void {
        if (!faction.blackboard) return;

        const tickets: DesireTicket[] = [];

        // 1. Tech Ambition (UPGRADE)
        // Formula: (Population / Pop_Cap)^2 * Sovereign.Stance_Exploit

        // Let's use current tier capacity from config based on tier
        let currentCap = config.upgrades.villageToTown.popCap;
        if (settlement.tier === 1) currentCap = config.upgrades.townToCity.popCap;
        if (settlement.tier === 2) currentCap = config.upgrades.city.popCap;

        const popRatio = Math.min(1.0, settlement.population / currentCap);
        const exploitStance = faction.blackboard.stances.exploit;
        const expandStance = faction.blackboard.stances.expand;

        // FIXED: Upgrading is also useful for Expansion (Higher Caps). 
        // Don't zero it out completely if we are in EXPAND mode.
        // Formula: Exploit + (Expand * 0.5)
        const stanceModifier = exploitStance + (expandStance * 0.5);

        let upgradeScore = Math.pow(popRatio, 2) * stanceModifier;

        // Penalty: Multiply by 0.1 if SURVIVE mode is active (assuming surviveMode is in aiState)
        if (settlement.aiState?.surviveMode) {
            upgradeScore *= config.ai.governor.weights.survivePenalty;
        }

        if (upgradeScore > config.ai.governor.thresholds.upgrade) {
            tickets.push({
                settlementId: settlement.id,
                type: 'UPGRADE',
                score: upgradeScore,
                needs: ['Stone', 'Timber', 'Ore']
            });
        }

        // 2. Territorial Ambition (SETTLER)
        // Formula: 0.8 * Sovereign.Stance_Expand * (Population / (Settler_Cost * 2))
        // expandStance is already defined above
        const settlerCost = config.ai.settlerCost;
        const settlerRatio = Math.min(1.0, settlement.population / (settlerCost * config.ai.governor.weights.settlerCostBuffer)); // Cap at 1.0 if we have double the cost
        const settlerScore = config.ai.governor.weights.settlerExpandBase * expandStance * settlerRatio;

        if (settlerScore > config.ai.governor.thresholds.settler) {
            tickets.push({
                settlementId: settlement.id,
                type: 'SETTLER',
                score: settlerScore,
                needs: Object.keys(config.costs.agents.Settler) as (keyof Resources)[]
            });
        }

        // 3. Trade Ambition (CARAVAN)
        const shortages = faction.blackboard.criticalShortages.length;
        const caravanScore = config.ai.governor.weights.tradeBase + (config.ai.governor.weights.tradeShortage * shortages);

        if (caravanScore > config.ai.governor.thresholds.trade) {
            tickets.push({
                settlementId: settlement.id,
                type: 'TRADE_CARAVAN', // Mapped from CARAVAN
                score: Math.min(1.0, caravanScore),
                needs: Object.keys(config.costs.agents.Caravan) as (keyof Resources)[]
            });
        }

        // 4. Labor Ambition (VILLAGER)
        if (!settlement.aiState?.surviveMode) {
            // FIXED: Decoupled Agent Recruitment from City Job Cap
            // Agents are independent of city jobs (workingPop).
            // Agent Cap = Population / popRatio (e.g. 100 / 25 = 4 agents)
            const villagersConfig = config.costs.villagers;
            const popRatio = (villagersConfig && villagersConfig.popRatio) ? villagersConfig.popRatio : 25;
            const base = config.costs.villagers?.baseVillagers || 1;
            const maxAgents = Math.max(base, Math.floor(settlement.population / popRatio));
            const currentAgents = (settlement.availableVillagers || 0) + Object.values(state.agents).filter(a => a.type === 'Villager' && (a as any).homeId === settlement.id).length;

            // Saturation Ratio
            const agentRatio = Math.min(1.0, currentAgents / maxAgents);

            // Calculate local food surplus ratio
            // SafeLevel = consumption * surviveTicks
            const consumption = Math.max(1, settlement.population * (config.costs.baseConsume || 0.1));
            const safeLevel = consumption * (config.ai.thresholds.surviveTicks || 20);

            // AGGRESSIVE RECRUITMENT:
            // We want to recruit as long as we have > 1.2x SafeLevel (20% buffer).
            // Original logic mapped (Surplus - Safe) / Safe. 
            // If Surplus = 1.2 * Safe, then Ratio = (1.2S - S)/S = 0.2.
            let foodSurplusRatio = 0;
            if (settlement.stockpile.Food > safeLevel) {
                // How much surplus? Cap at 2x safe level = 1.0
                foodSurplusRatio = Math.min(1.0, (settlement.stockpile.Food - safeLevel) / safeLevel);
            }

            // If we have at least 20% surplus (0.2), we treat food as "Good Enough" (1.0 multiplier)
            // This prevents the linear scaling from killing priority when we have "just enough".
            const foodScore = foodSurplusRatio >= (config.ai.thresholds.recruitBuffer || 0.1) ? 1.0 : (foodSurplusRatio * 5);

            const villagerScore = (1.0 - agentRatio) * foodScore;

            if (villagerScore > config.ai.governor.thresholds.recruit) {
                tickets.push({
                    settlementId: settlement.id,
                    type: 'RECRUIT_VILLAGER',
                    score: villagerScore,
                    needs: Object.keys(config.costs.agents.Villager) as (keyof Resources)[]
                });
            }
        }

        // 5. Infrastructure Ambition
        // GRANARY: (1.0 - Food_Health) * (Role == 'GRANARY' ? 1.5 : 1.0)
        // FISHERY: (1.0 - Food_Health) * (Adjacent_Water_Count > 0 ? 1.5 : 0.0)
        // SMITHY: (1.0 - (Tools / (Pop * 0.2))) * (Role == 'MINING' ? 1.2 : 1.0)

        // Food Health: 0.0 (Starving) to 1.0 (Full)
        // Let's use the foodSurplusRatio calculated above, or simple percentage of storage cap? 
        // Milestone formula implies "Need". So (1.0 - Health) means "Low Health = High Score".
        // Let's use (Food / Capacity) or similar.
        // Actually, let's use the "Safe Level" logic. 
        // If Food < SafeLevel, Health is low.
        // Health = Current / (SafeLevel * 2). Clamped 0-1.
        const consumption = Math.max(1, settlement.population * (config.costs.baseConsume || 0.1));
        const safeLevel = consumption * (config.ai.thresholds.surviveTicks || 20);
        const foodHealth = Math.min(1.0, settlement.stockpile.Food / (safeLevel * 2));

        // Granary
        const roleMultiplier = settlement.role === 'GRANARY' ? config.ai.governor.weights.granaryRole : 1.0;
        const granaryScore = (1.0 - foodHealth) * roleMultiplier;
        if (granaryScore > config.ai.governor.thresholds.infrastructure) {
            tickets.push({
                settlementId: settlement.id,
                type: 'BUILD_GRANARY',
                score: Math.min(1.0, granaryScore),
                needs: ['Timber', 'Stone']
            });
        }

        // Fishery
        // Need to check adjacent water. State map required?
        // We can check local hex terrain from map if we have it?
        // Governor has access to State.
        // Optimization: Don't scan neighbors every tick. Store "hasWater" in settlement?
        // For now, scan neighbors of settlement hex.
        const centerHex = state.map[settlement.hexId];
        let waterCount = 0;
        if (centerHex) {
            const neighbors = this.getNeighbors(centerHex, state);
            waterCount = neighbors.filter(n => n.terrain === 'Water').length;
        }

        const fisheryScore = (1.0 - foodHealth) * (waterCount > 0 ? config.ai.governor.weights.fisheryWater : 0.0);
        if (fisheryScore > config.ai.governor.thresholds.infrastructure) {
            tickets.push({
                settlementId: settlement.id,
                type: 'BUILD_FISHERY',
                score: Math.min(1.0, fisheryScore),
                needs: ['Timber']
            });
        }

        // Smithy
        // (1.0 - (Tools / (Pop * 0.2)))
        // FIXED: Don't build Smithy if we are starving or if we are a mere Village
        if (!settlement.aiState?.surviveMode && settlement.tier >= 1) {
            const desiredTools = settlement.population * config.ai.governor.weights.toolPerPop; // 1 tool per 5 people?
            // Avoid divide by zero
            const currentTools = settlement.stockpile.Tools || 0;
            const toolHealth = desiredTools > 0 ? Math.min(1.0, currentTools / desiredTools) : 1.0;

            const miningMultiplier = settlement.role === 'MINING' ? config.ai.governor.weights.smithyRole : 1.0;
            // Lower priority of Smithy (divide by 2) to ensure Survival/Recruit is higher
            const smithyScore = ((1.0 - toolHealth) * miningMultiplier) * 0.5;

            if (smithyScore > config.ai.governor.thresholds.infrastructure) {
                tickets.push({
                    settlementId: settlement.id,
                    type: 'BUILD_SMITHY',
                    score: Math.min(1.0, smithyScore),
                    needs: ['Stone', 'Ore']
                });
            }
        }

        // 6. Survival Ambition (Food Security)
        if (foodHealth < 0.8) {
            const surviveScore = (1.0 - foodHealth) * 5.0; // Scaled 1.0 to 5.0
            tickets.push({
                settlementId: settlement.id,
                type: 'REPLENISH',
                score: surviveScore,
                needs: ['Food']
            });
        }

        // 7. Logistics Ambition (REQUEST_FREIGHT)
        // If stock < 20% of goal, request freight
        if (settlement.resourceGoals) {
            Object.entries(settlement.resourceGoals).forEach(([res, goal]) => {
                const stock = settlement.stockpile[res as keyof Resources] || 0;
                if (stock < (goal as number) * 0.2) {
                    tickets.push({
                        settlementId: settlement.id,
                        type: 'REQUEST_FREIGHT',
                        score: 0.8, // Fairly high
                        needs: [res]
                    });
                }
            });
        }

        // Omitted for brevity/simplicity in this pass, as LogisticsStrategy handles some of this.
        // But per requirements: "High score if specific resource < 20% of its goal"

        // Submit all tickets
        if (!faction.blackboard.desires) faction.blackboard.desires = [];
        faction.blackboard.desires.push(...tickets);
    }

    private static getNeighbors(hex: any, state: WorldState): any[] {
        // Simple q/r/s neighbor logic
        const directions = [
            { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
            { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 }
        ];
        const neighbors: any[] = [];
        directions.forEach(d => {
            const nQ = hex.coordinate.q + d.q;
            const nR = hex.coordinate.r + d.r;
            // Key format "q,r" 
            const id = `${nQ},${nR}`;
            if (state.map[id]) neighbors.push(state.map[id]);
        });
        return neighbors;
    }
}
