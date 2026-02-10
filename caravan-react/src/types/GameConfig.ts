import { Resources, TerrainType } from './WorldTypes';

export interface GameConfig {
    simulation: {
        tickRate: number; // ms per tick (game loop speed)
        resourceTickInterval: number; // How many game ticks per resource tick
    };
    costs: {
        movement: number; // Base movement points per tick
        terrain: Record<TerrainType, number>; // Cost per hex
        baseConsume: number; // Food per pop per resource tick
        growthRate: number; // Population growth per tick if fed (0.01 = 1%)
        maxLaborPerHex: number; // Max jobs per hex
        maintenancePerPop: number; // Stone/Timber per pop per resource tick
        yieldPerPop: number; // Percentage yield bonus per population (e.g. 0.01 = 1%)
        toolBonus: number; // Yield multiplier when using tools (e.g. 1.2)
        toolBreakChance: number; // Chance to consume a tool per extraction tick (0-1)
        starvationRate: number;
        growthSurplusBonus: number;
        settlement: Partial<Resources>;
        trade: {
            caravanTimberCost: number;
            simulatedGoldPerResource: number;
            capacity: number;
            spawnChance: number;
            surplusThresholdMulti: number; // e.g. 50x consumption
            neighborSurplusMulti: number; // e.g. 20x consumption
            buyCap: number; // Max amount to buy per trip
            loadingTime: number; // Ticks to wait at destination
            forceTradeGold: number;
        };
        logistics: {
            caravanIntegrityLossPerHex: number;
            caravanRepairCost: number;
            freightThreshold: number;
            tradeRoiThreshold: number;
            constructionRoiThreshold: number;
            freightConstructionThreshold: number;
        };
        villagers: {
            cost: number; // Food cost to spawn? Or passive?
            speed: number;
            capacity: number;
            range: number;
            popRatio: number; // 1 villager per X pop
            baseVillagers: number;
        };
    };
    economy: {
        taxRate: number;
    };
    industry: {
        targetToolRatio: number;
        costTimber: number;
        costOre: number;
        surplusThreshold: number;
    };
    upgrades: {
        villageToTown: {
            population: number;
            plainsCount: number;
            costTimber: number;
            costStone: number;
            popCap: number;
        };
        townToCity: {
            population: number;
            plainsCount: number;
            costTimber: number;
            costStone: number;
            costOre: number;
            popCap: number;
        };
        city: {
            popCap: number;
        };
    };
    yields: Record<TerrainType, Partial<Resources>>;
    ai: {
        settlementCap: number;
        settlerCost: number; // Pop cost
        expansionBuffer: number;
        expansionStarterPack: Resources;
        checkInterval: number;
        longCheckInterval: number;
        thresholds: {
            surviveFood: number;
            surviveTicks: number;
            recruitBuffer: number;
            upgradeMinPop: number;
            upgradePopRatio: number;
            minConstructionBuffer: number;
            militarySurplusTimber: number;
            militarySurplusStone: number;
            villagerJobScoreMulti: number;
            newSettlementPop: number;
            newSettlementIntegrity: number;
        };
        chances: {
            guardPostBuild: number;
        };
        weights: {
            base: number;
            foodBonus: number;
            goalPriority: number;
            goalBonus: number;
            stockpileLow: number;
        };
    };
    maintenance: {
        decayRate: number;
        repairAmount: number;
        repairCostFactor: number;
        resourceSplit: {
            Stone: number;
            Timber: number;
        };
    };
    buildings: Record<string, {
        name: string;
        cost: Partial<Resources>;
        minTier: number;
        description: string;
        effects?: {
            type: 'YIELD_BONUS' | 'STORAGE' | 'DEFENSE' | 'MOVEMENT';
            value: number;
            resource?: keyof Resources;
        }[];
    }>;
}


export const DEFAULT_CONFIG: GameConfig = {
    simulation: {
        tickRate: 100,
        resourceTickInterval: 10,
    },
    costs: {
        movement: 1.0, // Base Movement Points per Tick
        terrain: {
            Plains: 1.0,
            Forest: 1.5,
            Hills: 2.0,
            Mountains: 3.0,
            Water: 999.9,
        },
        baseConsume: 0.1,
        growthRate: 0.008,
        maxLaborPerHex: 40,
        maintenancePerPop: 0.005,
        yieldPerPop: 0.01,
        toolBonus: 1.5,
        toolBreakChance: 0.05,
        starvationRate: 0.02, // Starvation penalty per tick
        growthSurplusBonus: 0.0001, // Multiplier for growth based on food surplus ratio
        settlement: {
            Food: 500,
            Timber: 200,
        },
        trade: {
            caravanTimberCost: 50,
            simulatedGoldPerResource: 1, // Simple fixed price for now
            capacity: 50,
            spawnChance: 0.1, // 10% chance per tick to spawn a caravan if conditions met
            surplusThresholdMulti: 50,
            neighborSurplusMulti: 20,
            buyCap: 50,
            loadingTime: 20,
            forceTradeGold: 50,
        },
        logistics: {
            caravanIntegrityLossPerHex: 0.5,
            caravanRepairCost: 2, // Timber
            freightThreshold: 40, // Min resources to dispatch
            tradeRoiThreshold: 20,
            constructionRoiThreshold: 50, // Min value to BUILD a new caravan
            freightConstructionThreshold: 100, // Min resources to BUILD a new caravan
        },
        villagers: {
            cost: 100, // Food cost to buy a new villager
            speed: 0.5, // Slow down to 0.5 hex/tick (Takes 2 ticks to move 1 plains hex)
            capacity: 20,
            range: 3,
            popRatio: 50,
            baseVillagers: 2,
        },
    },
    economy: {
        taxRate: 0.005,
    },
    industry: {
        targetToolRatio: 0.2,
        costTimber: 5,
        costOre: 2,
        surplusThreshold: 50,
    },
    upgrades: {
        villageToTown: {
            popCap: 200, // Cap for Village (Tier 0)
            population: 100, // Req to Upgrade
            plainsCount: 1,
            costTimber: 300,
            costStone: 150,
        },
        townToCity: {
            popCap: 500, // Cap for Town (Tier 1)
            population: 400, // Req to Upgrade
            plainsCount: 2,
            costTimber: 800,
            costStone: 400,
            costOre: 200,
        },
        city: {
            popCap: 2000 // Cap for City (Tier 2)
        }
    },
    yields: {
        Plains: {
            Food: 4,
            Timber: 1,
        },
        Forest: {
            Timber: 4,
            Food: 2,
        },
        Hills: {
            Stone: 2,
            Ore: 1,
        },
        Mountains: {
            Ore: 2,
            Stone: 1,
        },
        Water: {
            Food: 3,
            Gold: 0.75,
        },
    },
    ai: {
        settlementCap: 5,
        settlerCost: 50,
        expansionBuffer: 1.5,
        expansionStarterPack: {
            Food: 100,
            Timber: 50,
            Stone: 20,
            Ore: 0,
            Tools: 0,
            Gold: 0
        },
        checkInterval: 10,
        longCheckInterval: 50,
        thresholds: {
            surviveFood: 50,
            surviveTicks: 20,
            recruitBuffer: 2.0, // Multiplier of surviveFood for villager recruitment
            upgradeMinPop: 0.9,
            upgradePopRatio: 0.8,
            minConstructionBuffer: 50,
            militarySurplusTimber: 200,
            militarySurplusStone: 100,
            villagerJobScoreMulti: 10,
            newSettlementPop: 100,
            newSettlementIntegrity: 100,
        },
        chances: {
            guardPostBuild: 0.05,
        },
        weights: {
            base: 1.0,
            foodBonus: 1.0,
            goalPriority: 2.0, // Multiplier
            goalBonus: 5.0, // Flat
            stockpileLow: 5.0, // Flat or Mult? Let's say Flat for now or we update system
        },
    },
    maintenance: {
        decayRate: 2,
        repairAmount: 10,
        repairCostFactor: 0.05,
        resourceSplit: {
            Stone: 0.3,
            Timber: 0.7
        }
    },
    buildings: {
        'GathererHut': {
            name: "Gatherer's Hut",
            cost: { Timber: 50 },
            minTier: 0,
            description: "+20% Yield on Hex",
            effects: [{ type: 'YIELD_BONUS', value: 0.2 }]
        },
        'Warehouse': {
            name: "Warehouse",
            cost: { Timber: 100, Stone: 50 },
            minTier: 1,
            description: "Increases Storage Cap",
            effects: [{ type: 'STORAGE', value: 1000 }]
        },
        'Sawmill': {
            name: "Sawmill",
            cost: { Timber: 200 },
            minTier: 1,
            description: "Produces Planks (Future)",
        },
        'Masonry': {
            name: "Masonry",
            cost: { Stone: 200 },
            minTier: 1,
            description: "Produces Blocks (Future)",
        },
        'Smithy': {
            name: "Smithy",
            cost: { Stone: 150, Ore: 50 },
            minTier: 1,
            description: "Produces Tools",
        },
        'PavedRoad': {
            name: "Paved Road",
            cost: { Stone: 10 },
            minTier: 0,
            description: "+50% Movement Speed",
            effects: [{ type: 'MOVEMENT', value: 0.5 }]
        },
        'GuardPost': {
            name: "Guard Post",
            cost: { Timber: 100, Stone: 20 },
            minTier: 0,
            description: "Spawns Patrol",
        },
        'Watchtower': {
            name: "Watchtower",
            cost: { Stone: 80 },
            minTier: 0,
            description: "Fog Clearance + Defense",
            effects: [{ type: 'DEFENSE', value: 2.0 }]
        },
    },
};