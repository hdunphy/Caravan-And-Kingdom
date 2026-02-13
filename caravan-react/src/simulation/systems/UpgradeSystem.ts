import { WorldState } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { Logger } from '../../utils/Logger.ts';
import { HexUtils } from '../../utils/HexUtils.ts';

export const UpgradeSystem = {
    // Main Loop Update (Auto-Upgrade for Player for now)
    update(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(settlement => {
            // Auto-upgrade Player settlements for now (until UI)
            if (settlement.ownerId === 'player_1') {
                this.tryUpgrade(state, settlement, config);
            }
        });
    },

    tryUpgrade(state: WorldState, settlement: any, config: GameConfig): boolean {
        if (settlement.tier === 0) {
            if (this.canUpgradeToTown(settlement, config)) {
                this.performUpgradeToTown(state, settlement, config);
                return true;
            }
        }
        // Town -> City
        else if (settlement.tier === 1) {
            if (this.canUpgradeToCity(settlement, config)) {
                this.performUpgradeToCity(state, settlement, config);
                return true;
            }
        }
        return false;
    },

    canUpgradeToTown(settlement: any, config: GameConfig): boolean {
        const upgradeConfig = config.upgrades.villageToTown;

        // Resources & Pop
        if (settlement.population < upgradeConfig.population) return false;
        if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
        if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;

        return true;
    },

    performUpgradeToTown(state: WorldState, settlement: any, config: GameConfig) {
        const upgradeConfig = config.upgrades.villageToTown;
        settlement.stockpile.Timber -= upgradeConfig.costTimber;
        settlement.stockpile.Stone -= upgradeConfig.costStone;
        settlement.tier = 1;
        this.expandTerritory(state, settlement, 2);
        Logger.getInstance().log(`[Gov] ${settlement.name} upgraded to Town!`);
    },

    canUpgradeToCity(settlement: any, config: GameConfig): boolean {
        const upgradeConfig = config.upgrades.townToCity;

        // Resources & Pop
        if (settlement.population < upgradeConfig.population) return false;
        if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
        if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;
        if (settlement.stockpile.Ore < upgradeConfig.costOre) return false;

        return true;
    },

    performUpgradeToCity(state: WorldState, settlement: any, config: GameConfig) {
        const upgradeConfig = config.upgrades.townToCity;
        settlement.stockpile.Timber -= upgradeConfig.costTimber;
        settlement.stockpile.Stone -= upgradeConfig.costStone;
        settlement.stockpile.Ore -= upgradeConfig.costOre;
        settlement.tier = 2;
        this.expandTerritory(state, settlement, 3);
        Logger.getInstance().log(`[Gov] ${settlement.name} upgraded to City!`);
    },

    expandTerritory(state: WorldState, settlement: any, range: number) {
        const centerHex = state.map[settlement.hexId];
        if (centerHex) {
            const expandedCoords = HexUtils.getSpiral(centerHex.coordinate, range);
            const newControlledIds: string[] = [];

            expandedCoords.forEach(coord => {
                const id = HexUtils.getID(coord);
                const hex = state.map[id];
                if (!hex) return;

                // Exclusive Ownership Logic:
                // 1. If unowned, claim it (Set ownerId)
                // 2. If owned by SAME owner, keep it (Shared territory or re-affirming)
                // 3. If owned by DIFFERENT owner, SKIP it (Exclusive)

                if (hex.ownerId === null || hex.ownerId === undefined) {
                    // Claim it
                    hex.ownerId = settlement.ownerId;
                    newControlledIds.push(id);
                } else if (hex.ownerId === settlement.ownerId) {
                    // Already owned by us (or faction), keep it
                    newControlledIds.push(id);
                } else {
                    // Owned by rival, skip
                    // Logger.getInstance().log(`[UpgradeSystem] ${settlement.name} could not claim ${id} (Owned by ${hex.ownerId})`);
                }
            });

            settlement.controlledHexIds = newControlledIds;
            Logger.getInstance().log(`Territory expanded to ${newControlledIds.length} hexes.`);
        }
    }
};
