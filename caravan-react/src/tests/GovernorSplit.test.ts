import { describe, it, expect } from 'vitest';
import { AIController } from '../simulation/ai/AIController';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { WorldState } from '../types/WorldTypes';
import { GameConfig } from '../types/GameConfig';

describe('Governor Split (Parallel Execution)', () => {
    it('should execute both Villager and Caravan actions in the same tick', () => {
        // Setup State
        const state: WorldState = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '1,-1': { id: '1,-1', coordinate: { q: 1, r: -1, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' }, // Food for Villager
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'player_1', resources: { Timber: 100 } }, // Timber for Logistics
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Capital',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 10,
                    availableVillagers: 1,
                    controlledHexIds: ['0,0', '1,-1', '1,0'],
                    stockpile: { Food: 100, Timber: 0, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                    buildings: [],
                    tier: 1,
                    integrity: 100,
                    jobCap: 20,
                    workingPop: 0,
                    aiState: { surviveMode: false, savingFor: null, focusResources: [] },
                    currentGoal: 'EXPAND',
                    popHistory: [],
                    role: 'GENERAL'
                }
            },
            agents: {
                // Pre-existing Caravan for Transport Governor to use
                'c1': {
                    id: 'c1',
                    type: 'Caravan',
                    ownerId: 'player_1',
                    homeId: 's1',
                    position: { q: 0, r: 0, s: 0 },
                    target: undefined,
                    path: [],
                    cargo: {},
                    integrity: 100,
                    status: 'IDLE',
                    activity: 'IDLE',
                    mission: 'IDLE' // Needs assignment
                } as any
            },
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: 'blue', gold: 0, type: 'AI' }
            },
            tick: 100,
            width: 10,
            height: 10
        };

        const config: GameConfig = {
            costs: {
                movement: 1.0, // Base Movement Points per Tick
                terrain: { Plains: 1, Forest: 2, Mountain: 5, Water: 100 },
                agents: {
                    Villager: { Food: 10, Tools: 0 },
                    Settler: { Food: 100, Timber: 100 }, // Reduced for test
                    Caravan: { Timber: 50 }
                },
                baseConsume: 0.1,
                growthRate: 0.008,
                maxLaborPerHex: 40,
                maintenancePerPop: 0.005,
                yieldPerPop: 0.01,
                toolBonus: 1.5,
                toolBreakChance: 0.05,
                starvationRate: 0.005,
                growthSurplusBonus: 0.0001,
                trade: { simulatedGoldPerResource: 1, capacity: 50, spawnChance: 0.1, surplusThresholdMulti: 50, neighborSurplusMulti: 20, buyCap: 50, loadingTime: 20, forceTradeGold: 50, travelCostPerHex: 2 },
                logistics: { caravanIntegrityLossPerHex: 0.5, caravanRepairCost: 2, freightThreshold: 50, tradeRoiThreshold: 50, constructionRoiThreshold: 50, freightConstructionThreshold: 100 },
                villagers: { speed: 0.5, capacity: 10, range: 5, popRatio: 2, baseVillagers: 2 },
            },
            industry: { surplusThreshold: 100 },
            ai: {
                checkInterval: 1,
                utility: { provisionDistanceMulti: 1.0 },
                thresholds: {
                    surviveTicks: 20,
                    surviveFood: 50,
                    upgradePopRatio: 0.8
                },
                settlerCost: 10,
                expansionStarterPack: { Food: 50, Timber: 50 },
                sovereign: {
                    foodSurplusRatio: 0.8,
                    desperationFoodRatio: 0.5,
                    capPenalty: 0.1,
                    urgencyBoosts: { Stone: 0.2, Timber: 0.2, Ore: 0.1 },
                    capOverrideMultiplier: 1.5,
                    stanceShiftThreshold: 0.3,
                    scarcityThresholds: { Stone: 0.1, Timber: 0.1, Ore: 0.1 }
                },
                governor: {
                    thresholds: {
                        upgrade: 0.1,
                        settler: 0.1,
                        trade: 0.1,
                        recruit: 0.1,
                        infrastructure: 0.2
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
                        toolPerPop: 0.2
                    }
                }
            },
            upgrades: {
                villageToTown: { popCap: 200, costTimber: 100, costStone: 50 },
                townToCity: { popCap: 500, costTimber: 500, costStone: 200, costOre: 100 }
            },
            yields: {
                Plains: { Food: 2, Timber: 0, Stone: 0, Ore: 0, Gold: 0 },
                Forest: { Food: 1, Timber: 2, Stone: 0, Ore: 0, Gold: 0 },
                Mountain: { Food: 0, Timber: 0, Stone: 2, Ore: 1, Gold: 1 },
                Water: { Food: 1, Timber: 0, Stone: 0, Ore: 0, Gold: 0 }
            }
        } as any;

        const controller = new AIController();

        // Run Update
        controller.update(state, config);
        VillagerSystem.update(state, config);

        // Verify Villager Dispatch (Labor Governor)
        const villagers = Object.values(state.agents).filter(a => a.type === 'Villager');
        console.log(`Villagers Spawned: ${villagers.length}`);
        expect(villagers.length).toBeGreaterThan(0);

        // Verify Caravan Dispatch (Transport Governor)
        const caravan = state.agents['c1'] as any; // Cast to any to access specific fields
        expect(caravan.mission).toBe('LOGISTICS');
        expect(caravan.target).toBeDefined(); // Should target 2,0
        console.log(`Caravan Mission: ${caravan.mission}`);

        // Verify AI Decisions Log
        const decisions = state.settlements['s1'].aiState?.lastDecisions;
        expect(decisions).toBeDefined();
        // Since LABOR might stay empty if we already have enough, but we forced availableVillagers=0
        expect(decisions!['LABOR']).toBeDefined(); // Villager actions
        expect(decisions!['TRANSPORT']).toBeDefined(); // Logistics actions
    });
});
