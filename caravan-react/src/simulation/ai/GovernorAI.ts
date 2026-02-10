import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ConstructionSystem } from '../systems/ConstructionSystem';
import { CaravanSystem } from '../systems/CaravanSystem';
import { VillagerSystem } from '../systems/VillagerSystem';
import { HexUtils } from '../../utils/HexUtils';

export class GovernorAI {
    static update(state: WorldState, faction: any, config: GameConfig) {
        // Manage each settlement belonging to this faction
        Object.values(state.settlements).forEach(settlement => {
            if (settlement.ownerId !== faction.id) return;

            // Logic: Attempt Upgrades
            UpgradeSystem.tryUpgrade(state, settlement, config);

            // Logic: Attempt Construction
            this.manageConstruction(state, settlement, config);

            // Logic: Manage Logistics (Freight)
            this.manageLogistics(state, settlement, config);

            // Logic: Manage Villagers
            this.manageVillagers(state, settlement, config);
        });
    }

    private static manageConstruction(state: WorldState, settlement: any, config: GameConfig) {
        // Maintenance Buffer
        const BUFFER = 50; // TODO: Move to config
        if (settlement.stockpile.Stone < BUFFER || settlement.stockpile.Timber < BUFFER) return;

        // 1. Check for Gatherer's Hut (Food)
        const needsFood = settlement.currentGoal === 'SURVIVE' || settlement.stockpile.Food < config.ai.thresholds.surviveFood * 2;

        if (needsFood) {
            // Find a Plains hex with no building
            const target = settlement.controlledHexIds.find((id: string) => {
                const hex = state.map[id];
                if (!hex || hex.terrain !== 'Plains') return false;

                // Check if occupied
                const hasBuilding = settlement.buildings && settlement.buildings.some((b: any) => b.hexId === id);
                return !hasBuilding;
            });

            if (target) {
                ConstructionSystem.build(state, settlement.id, 'GathererHut', target, config);
                return; // One build per tick
            }
        }

        // 2. Guard Post (Mock logic: 10% chance if surplus resources)
        const surplusTimber = 200; // TODO: Config
        const surplusStone = 100;

        if (settlement.stockpile.Timber > surplusTimber && settlement.stockpile.Stone > surplusStone) {
            const target = settlement.controlledHexIds.find((id: string) => {
                const hasBuilding = settlement.buildings && settlement.buildings.some((b: any) => b.hexId === id);
                return !hasBuilding;
            });

            if (target && Math.random() < 0.05) {
                ConstructionSystem.build(state, settlement.id, 'GuardPost', target, config);
            }
        }
    }

    private static manageLogistics(state: WorldState, settlement: any, config: GameConfig) {
        // Threshold check
        const threshold = config.costs.logistics?.freightThreshold || 40;

        settlement.controlledHexIds.forEach((hexId: string) => {
            // Don't dispatch to self
            if (hexId === settlement.hexId) return;

            const hex = state.map[hexId];
            if (hex && hex.resources) {
                // Sum total resources on hex
                const totalResources = (Object.values(hex.resources) as number[]).reduce((a, b) => a + b, 0);

                if (totalResources >= threshold) {
                    // Dispatch Caravan
                    // Check if we already have a caravan targeting this hex?
                    const existing = Object.values(state.agents).find(agent =>
                        agent.type === 'Caravan' &&
                        agent.ownerId === settlement.ownerId &&
                        agent.mission === 'LOGISTICS' &&
                        ((agent.target && hex.coordinate.q === agent.target.q && hex.coordinate.r === agent.target.r) || // In transit to it
                            (agent.tradeState === 'OUTBOUND' && agent.activity === 'LOADING')) // Already there loading
                    );

                    if (!existing) {
                        CaravanSystem.dispatch(state, settlement, hexId, 'LOGISTICS', config, {});
                    }
                }
            }
        });
    }

    private static manageVillagers(state: WorldState, settlement: any, config: GameConfig) {
        if (settlement.availableVillagers <= 0) return;

        // Villager Config
        const range = config.costs.villagers?.range || 3;
        const capacity = config.costs.villagers?.capacity || 20;

        // 1. Find jobs (Uncollected Resources)
        const jobs: { hexId: string, amount: number, dist: number }[] = [];
        const centerHex = state.map[settlement.hexId];

        settlement.controlledHexIds.forEach((hexId: string) => {
            if (hexId === settlement.hexId) return; // Center is auto-collected

            const hex = state.map[hexId];
            if (!hex || !hex.resources) return;

            const total = (Object.values(hex.resources) as number[]).reduce((a, b) => a + b, 0);
            if (total < 1) return; // Ignore trivial amounts

            const dist = HexUtils.distance(centerHex.coordinate, hex.coordinate);
            if (dist > range) return;

            jobs.push({ hexId, amount: total, dist });
        });

        // 2. Sort jobs (Prioritize high yield, then close distance)
        // Score = Amount / Distance
        jobs.sort((a, b) => (b.amount / b.dist) - (a.amount / a.dist));

        // 3. Assign
        for (const job of jobs) {
            if (settlement.availableVillagers <= 0) break;

            // Check if already assigned
            // Count existing villagers targeting this hex
            const assigned = Object.values(state.agents).filter(a =>
                a.type === 'Villager' &&
                a.homeId === settlement.id &&
                a.mission === 'GATHER' &&
                a.gatherTarget && HexUtils.getID(a.gatherTarget) === job.hexId
            ).length;

            // Simple Logic: 1 Villager per X resources? Or 1 per hex?
            // If resources > capacity * assigned, send more.
            if (job.amount > (assigned * capacity)) {
                // Dispatch
                VillagerSystem.spawnVillager(state, settlement.id, job.hexId);
            }
        }
    }
}
