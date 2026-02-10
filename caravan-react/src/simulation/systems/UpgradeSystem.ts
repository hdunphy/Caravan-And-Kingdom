import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { HexUtils } from '../../utils/HexUtils';

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

    // Try to upgrade a settlement if requirements are met
    tryUpgrade(state: WorldState, settlement: any, config: GameConfig): boolean {
        // Village -> Town
        if (settlement.tier === 0) {
            if (this.canUpgradeToTown(state, settlement, config)) {
                this.performUpgradeToTown(state, settlement, config);
                return true;
            }
        }
        // Town -> City
        else if (settlement.tier === 1) {
            if (this.canUpgradeToCity(state, settlement, config)) {
                this.performUpgradeToCity(state, settlement, config);
                return true;
            }
        }
        return false;
    },

    canUpgradeToTown(state: WorldState, settlement: any, config: GameConfig): boolean {
        const upgradeConfig = config.upgrades.villageToTown;

        // Resources & Pop
        if (settlement.population < upgradeConfig.population) return false;
        if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
        if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;

        // Terrain
        const centerHex = state.map[settlement.hexId];
        if (!centerHex) return false;

        const neighbors = HexUtils.getNeighbors(centerHex.coordinate);
        let plainsCount = (centerHex.terrain === 'Plains' ? 1 : 0);
        neighbors.forEach(n => {
            if (state.map[HexUtils.getID(n)]?.terrain === 'Plains') plainsCount++;
        });

        return plainsCount >= upgradeConfig.plainsCount;
    },

    performUpgradeToTown(state: WorldState, settlement: any, config: GameConfig) {
        const upgradeConfig = config.upgrades.villageToTown;
        settlement.stockpile.Timber -= upgradeConfig.costTimber;
        settlement.stockpile.Stone -= upgradeConfig.costStone;
        settlement.tier = 1;
        this.expandTerritory(state, settlement, 2);
        console.log(`[Gov] ${settlement.name} upgraded to Town!`);
    },

    canUpgradeToCity(state: WorldState, settlement: any, config: GameConfig): boolean {
        const upgradeConfig = config.upgrades.townToCity;

        // Resources & Pop
        if (settlement.population < upgradeConfig.population) return false;
        if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
        if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;
        if (settlement.stockpile.Ore < upgradeConfig.costOre) return false;

        // Terrain
        const centerHex = state.map[settlement.hexId];
        if (!centerHex) return false;

        const neighbors = HexUtils.getNeighbors(centerHex.coordinate);
        let plainsCount = (centerHex.terrain === 'Plains' ? 1 : 0);
        neighbors.forEach(n => {
            if (state.map[HexUtils.getID(n)]?.terrain === 'Plains') plainsCount++;
        });

        return plainsCount >= upgradeConfig.plainsCount;
    },

    performUpgradeToCity(state: WorldState, settlement: any, config: GameConfig) {
        const upgradeConfig = config.upgrades.townToCity;
        settlement.stockpile.Timber -= upgradeConfig.costTimber;
        settlement.stockpile.Stone -= upgradeConfig.costStone;
        settlement.stockpile.Ore -= upgradeConfig.costOre;
        settlement.tier = 2;
        this.expandTerritory(state, settlement, 3);
        console.log(`[Gov] ${settlement.name} upgraded to City!`);
    },

    expandTerritory(state: WorldState, settlement: any, range: number) {
        const centerHex = state.map[settlement.hexId];
        if (centerHex) {
            const expandedCoords = HexUtils.getSpiral(centerHex.coordinate, range);
            const newControlledIds = expandedCoords
                .map(c => HexUtils.getID(c))
                .filter(id => state.map[id]);

            settlement.controlledHexIds = newControlledIds;
            // console.log(`Territory expanded to ${newControlledIds.length} hexes.`);
        }
    }
};
