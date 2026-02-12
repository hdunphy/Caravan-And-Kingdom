import { WorldState, Resources, TerrainType, HexCoordinate } from '../../types/WorldTypes';
import { HexUtils } from '../../utils/HexUtils';
import { GameConfig } from '../../types/GameConfig';

export const ExtractionSystem = {
    update(state: WorldState, config: GameConfig) {
        Object.values(state.settlements).forEach(settlement => {
            const centerHexId = settlement.hexId;
            const centerHex = state.map[centerHexId];
            if (!centerHex) return;

            // Check for Tools (Bonus Multiplier)
            let hasTools = settlement.stockpile.Tools >= 1;
            const toolMult = hasTools ? config.costs.toolBonus : 1.0;

            // Handle Tool Breakage
            if (hasTools) {
                if (Math.random() < config.costs.toolBreakChance) {
                    settlement.stockpile.Tools = Math.max(0, settlement.stockpile.Tools - 1);
                }
            }

            // Iterate all controlled hexes (Passive Production)
            settlement.controlledHexIds.forEach(hexId => {
                const hex = state.map[hexId];
                if (!hex) return;

                // Full utilization for passive generation (represented by Villagers later)
                // We assume the resource "grows" or "appears" and waits for collection.
                const utilization = 1.0;

                this.extractFromHex(state, settlement, hexId, hex.terrain, config, toolMult, utilization);

                // Fishery Logic: If this land tile has a Fishery, extract from adjacent Water
                if (settlement.buildings) {
                    const building = settlement.buildings.find((b: any) => b.hexId === hexId && b.type === 'Fishery' && b.integrity > 0);
                    if (building) {
                        const neighbors = HexUtils.getNeighbors(hex.coordinate);
                        neighbors.forEach((nCoord: HexCoordinate) => {
                            const nId = HexUtils.getID(nCoord);
                            const nHex = state.map[nId];
                            if (nHex && nHex.terrain === 'Water') {
                                // Extract from water, but deposit ON THIS LAND HEX (the Fishery)
                                this.extractFromHex(state, settlement, hexId, 'Water', config, toolMult, utilization);
                            }
                        });
                    }
                }
            });
        });
    },

    extractFromHex(state: WorldState, settlement: any, hexId: string, terrain: TerrainType, config: GameConfig, toolMult: number, utilization: number) {
        const yieldData = config.yields[terrain];
        if (!yieldData) return;

        // Check for Building Bonuses
        let buildingMult = 1.0;
        if (settlement.buildings) {
            const building = settlement.buildings.find((b: any) => b.hexId === hexId);
            if (building && building.integrity > 0) {
                const buildConfig = config.buildings[building.type];
                if (buildConfig && buildConfig.effects) {
                    buildConfig.effects.forEach(effect => {
                        if (effect.type === 'YIELD_BONUS') {
                            // additive or multiplicative? 
                            // Logic was: buildingMult = 1.2 (which is +20%)
                            // If multiple buildings (unlikely per hex), additive is safer.
                            // But buildingMult starts at 1.0.
                            buildingMult += effect.value;
                        }
                    });
                }
            }
        }

        // Yield = Base * Utilization * Tools * Building
        const totalMult = utilization * toolMult * buildingMult;

        (Object.entries(yieldData) as [keyof Resources, number][]).forEach(([resource, amount]) => {
            const yieldAmount = amount * totalMult;
            if (resource === 'Gold') {
                // Gold -> Faction
                const faction = state.factions[settlement.ownerId];
                if (faction) {
                    faction.gold = (faction.gold || 0) + yieldAmount;
                }
            } else {
                // Check if Center Hex
                if (hexId === settlement.hexId) {
                    // Center -> Stockpile directly
                    settlement.stockpile[resource] += yieldAmount;
                } else {
                    // Remote -> Accumulate on Hex for Logistics/Villagers
                    const mapHex = state.map[hexId];
                    if (mapHex) {
                        if (!mapHex.resources) mapHex.resources = {};
                        mapHex.resources[resource] = (mapHex.resources[resource] || 0) + yieldAmount;
                    }
                }
            }
        });
    }
};
