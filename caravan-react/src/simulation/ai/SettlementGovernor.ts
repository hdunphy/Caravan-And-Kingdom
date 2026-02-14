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

        // Initialize Decisions Log
        if (!settlement.aiState) {
            settlement.aiState = {
                surviveMode: false,
                savingFor: null,
                focusResources: []
            };
        }

        settlement.aiState.lastDecisions = {
            CIVIL: [],
            LABOR: [],
            TRANSPORT: [],
            TRADE: []
        };

        // Helper to log decision
        const logDecision = (category: 'CIVIL' | 'LABOR' | 'TRANSPORT' | 'TRADE', type: string, score: number) => {
            settlement.aiState.lastDecisions![category]!.push(`${type}: ${score.toFixed(2)}`);
        };

        // 1. Tech Ambition (UPGRADE)
        // ... (lines 19-35) ...
        const currentCap = (settlement.tier === 1 ? config.upgrades.townToCity.popCap : (settlement.tier === 2 ? config.upgrades.city.popCap : config.upgrades.villageToTown.popCap));
        const popRatio = Math.min(1.0, settlement.population / currentCap);
        const exploitStance = faction.blackboard.stances.exploit;
        const expandStance = faction.blackboard.stances.expand;
        const stanceModifier = exploitStance + (expandStance * 0.5);
        let upgradeScore = Math.pow(popRatio, 2) * stanceModifier;

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
            logDecision('CIVIL', 'UPGRADE', upgradeScore);
        }

        // 2. Territorial Ambition (SETTLER)
        const settlerCost = config.ai.settlerCost;
        const settlerRatio = Math.min(1.0, settlement.population / (settlerCost * config.ai.governor.weights.settlerCostBuffer));
        const settlerScore = config.ai.governor.weights.settlerExpandBase * expandStance * settlerRatio;

        if (settlerScore > config.ai.governor.thresholds.settler) {
            tickets.push({
                settlementId: settlement.id,
                type: 'SETTLER',
                score: settlerScore,
                needs: Object.keys(config.costs.agents.Settler) as (keyof Resources)[]
            });
            logDecision('CIVIL', 'SETTLER', settlerScore);
        }

        // 3. Trade Ambition (CARAVAN)
        const shortages = faction.blackboard.criticalShortages.length;
        const caravanScore = config.ai.governor.weights.tradeBase + (config.ai.governor.weights.tradeShortage * shortages);

        if (caravanScore > config.ai.governor.thresholds.trade) {
            tickets.push({
                settlementId: settlement.id,
                type: 'TRADE_CARAVAN',
                score: Math.min(1.0, caravanScore),
                needs: Object.keys(config.costs.agents.Caravan) as (keyof Resources)[]
            });
            logDecision('TRADE', 'TRADE_CARAVAN', caravanScore);
        }

        // 4. Labor Ambition (VILLAGER)
        if (!settlement.aiState?.surviveMode) {
            const villagersConfig = config.costs.villagers;
            const popRatio = (villagersConfig && villagersConfig.popRatio) ? villagersConfig.popRatio : 25;
            const base = config.costs.villagers?.baseVillagers || 1;
            const maxAgents = Math.max(base, Math.floor(settlement.population / popRatio));
            const currentAgents = (settlement.availableVillagers || 0) + Object.values(state.agents).filter(a => a.type === 'Villager' && (a as any).homeId === settlement.id).length;
            const agentRatio = Math.min(1.0, currentAgents / maxAgents);

            const consumption = Math.max(1, settlement.population * (config.costs.baseConsume || 0.1));
            const safeLevel = consumption * (config.ai.thresholds.surviveTicks || 20);
            let foodSurplusRatio = 0;
            if (settlement.stockpile.Food > safeLevel) {
                foodSurplusRatio = Math.min(1.0, (settlement.stockpile.Food - safeLevel) / safeLevel);
            }
            const foodScore = foodSurplusRatio >= (config.ai.thresholds.recruitBuffer || 0.1) ? 1.0 : (foodSurplusRatio * 5);
            const villagerScore = (1.0 - agentRatio) * foodScore;

            if (villagerScore > config.ai.governor.thresholds.recruit) {
                tickets.push({
                    settlementId: settlement.id,
                    type: 'RECRUIT_VILLAGER',
                    score: villagerScore,
                    needs: Object.keys(config.costs.agents.Villager) as (keyof Resources)[]
                });
                logDecision('LABOR', 'RECRUIT_VILLAGER', villagerScore);
            }
        }

        // 5. Infrastructure Ambition
        const consumption = Math.max(1, settlement.population * (config.costs.baseConsume || 0.1));
        const safeLevel = consumption * (config.ai.thresholds.surviveTicks || 20);
        const foodHealth = Math.min(1.0, settlement.stockpile.Food / (safeLevel * 2));

        // Granary
        const roleMultiplier = settlement.role === 'GRANARY' ? config.ai.governor.weights.granaryRole : 1.0;
        const granaryScore = (1.0 - foodHealth) * roleMultiplier;
        if (!settlement.buildings.some(b => b.type === 'Granary') && granaryScore > config.ai.governor.thresholds.infrastructure) {
            tickets.push({
                settlementId: settlement.id,
                type: 'BUILD_GRANARY',
                score: Math.min(1.0, granaryScore),
                needs: ['Timber', 'Stone']
            });
            logDecision('CIVIL', 'BUILD_GRANARY', granaryScore);
        }

        // Fishery
        const centerHex = state.map[settlement.hexId];
        let waterCount = 0;
        if (centerHex) {
            const neighbors = this.getNeighbors(centerHex, state);
            waterCount = neighbors.filter(n => n.terrain === 'Water').length;
        }
        const fisheryScore = (1.0 - foodHealth) * (waterCount > 0 ? config.ai.governor.weights.fisheryWater : 0.0);
        if (!settlement.buildings.some(b => b.type === 'Fishery') && fisheryScore > config.ai.governor.thresholds.infrastructure) {
            tickets.push({
                settlementId: settlement.id,
                type: 'BUILD_FISHERY',
                score: Math.min(1.0, fisheryScore),
                needs: ['Timber']
            });
            logDecision('CIVIL', 'BUILD_FISHERY', fisheryScore);
        }

        // Smithy
        if (!settlement.aiState?.surviveMode && settlement.tier >= 1) {
            const desiredTools = settlement.population * config.ai.governor.weights.toolPerPop;
            const currentTools = settlement.stockpile.Tools || 0;
            const toolHealth = desiredTools > 0 ? Math.min(1.0, currentTools / desiredTools) : 1.0;
            const miningMultiplier = settlement.role === 'MINING' ? config.ai.governor.weights.smithyRole : 1.0;
            const smithyScore = ((1.0 - toolHealth) * miningMultiplier) * 0.5;

            if (!settlement.buildings.some(b => b.type === 'Smithy') && smithyScore > config.ai.governor.thresholds.infrastructure) {
                tickets.push({
                    settlementId: settlement.id,
                    type: 'BUILD_SMITHY',
                    score: Math.min(1.0, smithyScore),
                    needs: ['Stone', 'Ore']
                });
                logDecision('CIVIL', 'BUILD_SMITHY', smithyScore);
            }
        }

        // 6. Survival Ambition
        if (foodHealth < 0.8) {
            const surviveScore = (1.0 - foodHealth) * 5.0;
            tickets.push({
                settlementId: settlement.id,
                type: 'REPLENISH',
                score: surviveScore,
                needs: ['Food']
            });
            logDecision('TRANSPORT', 'REPLENISH', surviveScore);
        }

        // 7. Logistics Ambition
        if (settlement.resourceGoals) {
            Object.entries(settlement.resourceGoals).forEach(([res, goal]) => {
                const stock = settlement.stockpile[res as keyof Resources] || 0;
                if (stock < (goal as number) * 0.2) {
                    tickets.push({
                        settlementId: settlement.id,
                        type: 'REQUEST_FREIGHT',
                        score: 0.8,
                        needs: [res]
                    });
                    logDecision('TRANSPORT', `REQUEST_${res.toUpperCase()}`, 0.8);
                }
            });
        }

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
