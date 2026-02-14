import { Resources, TerrainType } from './WorldTypes.ts';

export interface GameConfig {
    simulation: {
        tickRate: number; // ms per tick (game loop speed)
        resourceTickInterval: number; // How many game ticks per resource tick
    };
    isSilent?: boolean; // Global silence flag for logs
    costs: {
        movement: number; // Base movement points per tick
        terrain: Record<TerrainType, number>; // Cost per hex
        agents: {
            Villager: Partial<Resources>;
            Settler: Partial<Resources>;
            Caravan: Partial<Resources>;
        };
        baseConsume: number; // Food per pop per resource tick
        growthRate: number; // Population growth per tick if fed (0.01 = 1%)
        maxLaborPerHex: number; // Max jobs per hex
        maintenancePerPop: number; // Stone/Timber per pop per resource tick
        yieldPerPop: number; // Percentage yield bonus per population (e.g. 0.01 = 1%)
        toolBonus: number; // Yield multiplier when using tools (e.g. 1.2)
        toolBreakChance: number; // Chance to consume a tool per extraction tick (0-1)
        starvationRate: number;
        growthSurplusBonus: number;
        trade: {
            simulatedGoldPerResource: number;
            capacity: number;
            spawnChance: number;
            surplusThresholdMulti: number; // e.g. 50x consumption
            neighborSurplusMulti: number; // e.g. 20x consumption
            buyCap: number; // Max amount to buy per trip
            loadingTime: number; // Ticks to wait at destination
            forceTradeGold: number;
            travelCostPerHex: number;
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
            costTimber: number;
            costStone: number;
            popCap: number;
            radius: number;
        };
        townToCity: {
            population: number;
            costTimber: number;
            costStone: number;
            costOre: number;
            popCap: number;
            radius: number;
        };
        city: {
            popCap: number;
        };
    };
    yields: Record<TerrainType, Partial<Resources>>;
    ai: {
        settlementCap: number;
        settlerCost: number; // Pop cost
        settlerCooldown: number; // Ticks between settler spawns
        expansionBuffer: number;
        expansionStarterPack: Partial<Resources>;
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
        utility: {
            // 1. SURVIVE
            surviveThreshold: number; // Consumption * X ticks
            // 2. GROW
            growthFoodSafety: number; // Multiplier
            // 3. PROVISION 
            provisionDistanceMulti: number;
            // 4. ASCEND
            ascendReadinessPower: number;
            // 5. BUILD
            buildRateLookback: number;
            // 6. COMMERCIAL
            commercialLowThreshold: number;
            commercialSurplusThreshold: number;
            // 7. FLEET
            fleetTargetSize: number;
            // 8. EXPAND
            expandSearchRadius: number;
            expandSaturationPower: number;
            expandMinDistance: number;
        };
        bidding: {
            distanceWeight: number;
            saturationWeight: number;
            fulfillmentWeight: number;
        };

        sovereign: {
            checkInterval: number;
            foodSurplusRatio: number;
            desperationFoodRatio: number;
            scarcityThresholds: Partial<Record<keyof Resources, number>>;
            urgencyBoosts: Partial<Record<keyof Resources, number>>;
            capPenalty: number;
            capOverrideMultiplier: number;
            stanceShiftThreshold: number;
        };
        governor: {
            thresholds: {
                upgrade: number;
                settler: number;
                trade: number;
                recruit: number;
                infrastructure: number;
            };
            weights: {
                survivePenalty: number;
                settlerExpandBase: number;
                settlerCostBuffer: number;
                tradeBase: number;
                tradeShortage: number;
                granaryRole: number;
                fisheryWater: number;
                smithyRole: number;
                toolPerPop: number;
            };
        };
        feudal: {
            roleUtilityBonus: number;
            roleCheckInterval: number;
            trade: {
                maxDistance: number;
                surplusThreshold: number;
                deficitThreshold: number;
                checkInterval: number;
            };
            thresholds: {
                lumberForestRatio: number;
                miningHillRatio: number;
                granaryPlainsRatio: number;
            };
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
            Water: 1000.0,
        },
        agents: {
            Villager: { Food: 100 },
            Settler: { Food: 800, Timber: 400 }, // Increased from 500/200
            Caravan: { Timber: 50 }
        },
        baseConsume: 0.1,
        growthRate: 0.008,
        maxLaborPerHex: 40,
        maintenancePerPop: 0.005,
        yieldPerPop: 0.01,
        toolBonus: 1.5,
        toolBreakChance: 0.05,
        starvationRate: 0.005, // Lowered from 0.02 to prevent death spiral
        growthSurplusBonus: 0.0001, // Multiplier for growth based on food surplus ratio
        trade: {
            simulatedGoldPerResource: 1, // Simple fixed price for now
            capacity: 100, // Doubled from 50 (Balanced for Logistics Fix)
            spawnChance: 0.1, // 10% chance per tick to spawn a caravan if conditions met
            surplusThresholdMulti: 50,
            neighborSurplusMulti: 20,
            buyCap: 100, // Doubled from 50
            loadingTime: 20,
            forceTradeGold: 50,
            travelCostPerHex: 2,
        },
        logistics: {
            caravanIntegrityLossPerHex: 0.5,
            caravanRepairCost: 2, // Timber
            freightThreshold: 40, // Min resources to dispatch
            tradeRoiThreshold: 20.0, // Low threshold to encourage trade (Gen 199 Winner)
            constructionRoiThreshold: 4.5, // Aggressive caravan building (Gen 199 Winner)
            freightConstructionThreshold: 100, // Min resources to BUILD a new caravan
        },
        villagers: {
            speed: 0.5, // Slow down to 0.5 hex/tick (Takes 2 ticks to move 1 plains hex)
            capacity: 24, // Doubled from 12 (Balanced for Logistics Fix)
            range: 3,
            popRatio: 25, // Lowered from 50 (more villagers per pop - Balanced for Logistics Fix)
            baseVillagers: 2,
        },
    },
    economy: {
        taxRate: 0.005,
    },
    industry: {
        targetToolRatio: 0.033, // From Batch 9
        costTimber: 5,
        costOre: 2,
        surplusThreshold: 50,
    },
    upgrades: {
        villageToTown: {
            popCap: 200, // Cap for Village (Tier 0)
            population: 100, // Req to Upgrade
            costTimber: 300,
            costStone: 150,
            radius: 2,
        },
        townToCity: {
            popCap: 500, // Cap for Town (Tier 1)
            population: 400, // Req to Upgrade
            costTimber: 800,
            costStone: 400,
            costOre: 200,
            radius: 3,
        },
        city: {
            popCap: 2000 // Cap for City (Tier 2)
        }
    },
    yields: {
        Plains: {
            Food: 10,
            Timber: 4,
        },
        Forest: {
            Timber: 8,
            Food: 5,
        },
        Hills: {
            Stone: 6,
            Ore: 2,
        },
        Mountains: {
            Ore: 6,
            Stone: 4,
        },
        Water: {
            Food: 12,
            Gold: 3,
        },
    },
    ai: {
        settlementCap: 5,
        settlerCost: 50,
        settlerCooldown: 300, // Increased from 100 to slow expansion
        expansionBuffer: 6.0, // From Batch 9
        expansionStarterPack: {
            Food: 100,
            Timber: 50,
            Stone: 20,
            Ore: 0,
            Tools: 0,
            Gold: 0
        },
        checkInterval: 5,
        longCheckInterval: 50,
        thresholds: {
            surviveFood: 50,
            surviveTicks: 20,
            recruitBuffer: 0.60, // From Batch 9
            upgradeMinPop: 0.9,
            upgradePopRatio: 0.8,
            minConstructionBuffer: 50,
            militarySurplusTimber: 200,
            militarySurplusStone: 100,
            villagerJobScoreMulti: 1.79, // From Batch 9
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
            stockpileLow: 5.0,
        },
        feudal: {
            roleUtilityBonus: 0.25,
            roleCheckInterval: 200,
            trade: {
                maxDistance: 10,
                surplusThreshold: 500, // Fixed amount or ratio? User said "fills my capacity"
                deficitThreshold: 100,
                checkInterval: 50
            },
            thresholds: {
                lumberForestRatio: 0.3,
                miningHillRatio: 0.3,
                granaryPlainsRatio: 0.5
            }
        },
        utility: {
            surviveThreshold: 0.78, // From Batch 9
            growthFoodSafety: 0.18, // From Batch 9
            provisionDistanceMulti: 11.07, // From Batch 9
            ascendReadinessPower: 2.47, // From Batch 9
            buildRateLookback: 3.91, // From Batch 9
            commercialLowThreshold: 0.01, // From Batch 9
            commercialSurplusThreshold: 0.28, // From Batch 9
            fleetTargetSize: 1.52, // From Batch 9
            expandSearchRadius: 0.08, // From Batch 9
            expandSaturationPower: 0.06, // From Batch 9
            expandMinDistance: 36.29, // From Batch 9
        },
        bidding: {
            distanceWeight: 1.60, // From Batch 9
            saturationWeight: 0.56, // From Batch 9
            fulfillmentWeight: 0.17, // From Batch 9
        },

        sovereign: {
            checkInterval: 100,
            foodSurplusRatio: 0.8,
            desperationFoodRatio: 0.5,
            scarcityThresholds: {
                Stone: 0.1,
                Ore: 0.1,
                Timber: 0.1,
            },
            urgencyBoosts: {
                Stone: 0.5,
                Timber: 0.5,
                Ore: 0.3
            },
            capPenalty: 0.1,
            capOverrideMultiplier: 1.5,
            stanceShiftThreshold: 0.3,
        },
        governor: {
            thresholds: {
                upgrade: 0.1,
                settler: 0.1,
                trade: 0.1,
                recruit: 0.1,
                infrastructure: 0.2,
            },
            weights: {
                survivePenalty: 0.1,
                settlerExpandBase: 0.8,
                settlerCostBuffer: 2.0,
                tradeBase: 0.4,
                tradeShortage: 0.15,
                granaryRole: 1.5,
                fisheryWater: 1.5,
                smithyRole: 1.2,
                toolPerPop: 0.2,
            },
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
        'Fishery': {
            name: "Fishery",
            cost: { Timber: 100 },
            minTier: 0,
            description: "Extracts from adjacent Water",
        },
    },
};