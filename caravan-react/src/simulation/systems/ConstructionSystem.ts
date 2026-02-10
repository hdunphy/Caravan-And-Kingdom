import { WorldState, BuildingType, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';


export const ConstructionSystem = {
    build(state: WorldState, settlementId: string, buildingType: BuildingType, hexId: string, config: GameConfig): boolean {
        const settlement = state.settlements[settlementId];
        if (!settlement) return false;

        const hex = state.map[hexId];
        if (!hex) return false;

        // 1. Check if Hex is Controlled
        if (!settlement.controlledHexIds.includes(hexId)) return false;

        // 2. Check if Hex already has a building (MVP: One per hex? Or specific slots?)
        // Let's assume One Building Per Hex for now, EXCEPT Roads? 
        // User request: "Gatherer's Hut (Village Tier)... Increases yield of hex"
        // Let's strictly limit to 1 building per hex for MVP simplicity.
        const existing = settlement.buildings.find(b => b.hexId === hexId);
        if (existing) return false; // Already occupied

        // 3. Check Config & Tier
        const buildConfig = config.buildings[buildingType];
        if (!buildConfig) return false;

        if (settlement.tier < buildConfig.minTier) return false;

        // 4. Check Costs
        const cost = buildConfig.cost;
        if (!this.canAfford(settlement.stockpile, cost)) return false;

        // 5. Build
        // Deduct Resources
        this.payCost(settlement.stockpile, cost);

        // Add Building
        const newBuilding = {
            id: `bldg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: buildingType,
            hexId: hexId,
            integrity: 100,
            level: 1
        };

        if (!settlement.buildings) settlement.buildings = []; // Safety
        settlement.buildings.push(newBuilding);

        console.log(`[Construction] Built ${buildConfig.name} at ${hexId} for ${settlement.name}`);
        return true;
    },

    canAfford(stockpile: Resources, cost: Partial<Resources>): boolean {
        for (const [res, amount] of Object.entries(cost)) {
            if (stockpile[res as keyof Resources] < (amount as number)) return false;
        }
        return true;
    },

    payCost(stockpile: Resources, cost: Partial<Resources>) {
        for (const [res, amount] of Object.entries(cost)) {
            stockpile[res as keyof Resources] -= (amount as number);
        }
    }
};
