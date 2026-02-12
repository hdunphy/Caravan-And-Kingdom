
import { describe, it, expect } from 'vitest';
import { AIController } from '../simulation/ai/AIController';
import { WorldState } from '../types/WorldTypes';
import { GameConfig } from '../types/GameConfig';

describe('Governor Split (Parallel Execution)', () => {
    it('should execute both Villager and Caravan actions in the same tick', () => {
        // Setup State
        const state: WorldState = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '1,-1': { id: '1,-1', coordinate: { q: 1, r: -1, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' }, // Food for Villager
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', resources: { Timber: 200 }, ownerId: 'player_1' }, // Timber for Logistics
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Capital',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 10,
                    availableVillagers: 5,
                    controlledHexIds: ['0,0', '1,-1', '1,0'],
                    stockpile: { Food: 100, Timber: 0, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                    buildings: [],
                    tier: 1,
                    integrity: 100,
                    jobCap: 10,
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
                villagers: { cost: 10, capacity: 10, range: 5 },
                settlement: { Food: 100, Timber: 100 },
                baseConsume: 0.1,
                logistics: { freightThreshold: 50, tradeRoiThreshold: 50 },
                trade: { caravanTimberCost: 50, surplusThreshold: 200, forceTradeGold: 50, travelCostPerHex: 1, capacity: 50, simulatedGoldPerResource: 1, neighborSurplusMulti: 1.5 },
                terrain: { Plains: 1, Forest: 2, Mountain: 5, Water: 100 }
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
                expansionStarterPack: { Food: 50, Timber: 50 }
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
        expect(decisions!['LABOR']).toBeDefined(); // Villager actions
        expect(decisions!['TRANSPORT']).toBeDefined(); // Logistics actions
    });
});
