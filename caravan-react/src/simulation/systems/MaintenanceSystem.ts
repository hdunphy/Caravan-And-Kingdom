import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export const MaintenanceSystem = {
    update(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(settlement => {
            // 1. Settlement Infrastructure Maintenance (Population based)
            this.maintainSettlement(settlement, config);

            // 2. Building Maintenance
            if (!settlement.buildings) settlement.buildings = [];

            settlement.buildings.forEach((building: any) => {
                // Decay
                const decay = config.maintenance ? config.maintenance.decayRate : 2;
                building.integrity = Math.max(0, building.integrity - decay);

                // Repair Check
                if (building.integrity < 100) {
                    const buildConfig = config.buildings[building.type];
                    if (buildConfig && buildConfig.cost) {
                        this.attenptRepair(settlement, building, buildConfig.cost, config);
                    }
                }
            });
        });
    },

    maintainSettlement(settlement: any, config: GameConfig) {
        const maintenanceCostPerPop = config.costs.maintenancePerPop || 0.05;
        const totalCost = settlement.population * maintenanceCostPerPop;

        // Split cost based on config (Default: 30% Stone, 70% Timber)
        const splitStone = config.maintenance?.resourceSplit.Stone || 0.3;
        const splitTimber = config.maintenance?.resourceSplit.Timber || 0.7;

        const stoneNeeded = totalCost * splitStone;
        const timberNeeded = totalCost * splitTimber;

        let repaired = 0;

        // Pay Stone
        if (settlement.stockpile.Stone >= stoneNeeded) {
            settlement.stockpile.Stone -= stoneNeeded;
            repaired += splitStone;
        } else {
            const fraction = settlement.stockpile.Stone / Math.max(1, stoneNeeded);
            settlement.stockpile.Stone = 0;
            repaired += splitStone * fraction;
        }

        // Pay Timber
        if (settlement.stockpile.Timber >= timberNeeded) {
            settlement.stockpile.Timber -= timberNeeded;
            repaired += splitTimber;
        } else {
            const fraction = settlement.stockpile.Timber / Math.max(1, timberNeeded);
            settlement.stockpile.Timber = 0;
            repaired += splitTimber * fraction;
        }

        // Apply Integrity Changes
        if (repaired >= 0.99) {
            settlement.integrity = Math.min(100, settlement.integrity + 1);
        } else {
            const missing = 1.0 - repaired;
            const decayAmount = missing * 5;
            settlement.integrity = Math.max(0, settlement.integrity - decayAmount);
        }
    },

    attenptRepair(settlement: any, building: any, originalCost: any, config: GameConfig) {
        // Repair Settings
        const REPAIR_AMOUNT = config.maintenance?.repairAmount || 10;
        const COST_FACTOR = config.maintenance?.repairCostFactor || 0.05;

        // Do we need repair?
        if (building.integrity >= 100) return;

        // Check Costs
        let canAfford = true;
        const repairCost: any = {};

        for (const [res, amount] of Object.entries(originalCost)) {
            const cost = Math.ceil((amount as number) * COST_FACTOR);
            if (settlement.stockpile[res] < cost) {
                canAfford = false;
                break;
            }
            repairCost[res] = cost;
        }

        if (canAfford) {
            // Pay
            for (const [res, cost] of Object.entries(repairCost)) {
                settlement.stockpile[res] -= (cost as number);
            }
            // Fix
            building.integrity = Math.min(100, building.integrity + REPAIR_AMOUNT);
        }
    }
};
