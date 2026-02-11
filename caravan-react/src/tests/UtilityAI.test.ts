import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { AIController } from '../simulation/ai/AIController';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';

// Mock the systems to verify calls
vi.mock('../simulation/systems/VillagerSystem', () => ({
    VillagerSystem: {
        spawnVillager: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('../simulation/systems/CaravanSystem', () => ({
    CaravanSystem: {
        spawn: vi.fn(),
        dispatch: vi.fn(),
        update: vi.fn()
    }
}));

describe('Utility AI System', () => {
    let state: WorldState;
    let settlement: Settlement;
    let controller: AIController;

    beforeEach(() => {
        controller = new AIController();

        // Setup basic state
        settlement = {
            id: 'test_settlement',
            name: 'Test City',
            ownerId: 'player_1',
            hexId: '0,0',
            population: 100,
            stockpile: { Food: 500, Timber: 500, Stone: 500, Ore: 0, Tools: 0, Gold: 100 },
            buildings: [],
            availableVillagers: 10,
            tier: 0,
            integrity: 100,
            controlledHexIds: ['0,0'],
            jobCap: 200,
            workingPop: 100,
            popHistory: []
        };

        state = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: { Food: 100 } },
                '0,1': { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Forest', ownerId: null, resources: { Timber: 100 } },
                '0,2': { id: '0,2', coordinate: { q: 0, r: 2, s: -2 }, terrain: 'Hills', ownerId: null, resources: { Stone: 100 } },
            },
            settlements: { 'test_settlement': settlement },
            agents: {},
            factions: { 'player_1': { id: 'player_1', name: 'Player', color: 'blue' } },
            tick: 100,
            width: 10,
            height: 10
        };

        // Clear mocks
        vi.clearAllMocks();
    });

    // Create a specific config for testing with relaxed constraints
    const TEST_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (!TEST_CONFIG.ai.utility) TEST_CONFIG.ai.utility = {};
    TEST_CONFIG.ai.utility.expandMinDistance = 1; // Allow close expansion for test map

    // 1. UNIT TESTS - DESIRES (Functional Check)
    describe('Desire: SURVIVE (Food Security)', () => {
        it('should trigger GATHER_FOOD (spawnVillager) when Food is 0', () => {
            settlement.stockpile.Food = 0;
            controller.update(state, TEST_CONFIG);

            // Should prioritize food gathering from 0,0 (Plains/Food)
            expect(VillagerSystem.spawnVillager).toHaveBeenCalledWith(
                expect.anything(),
                settlement.id,
                '0,0',
                expect.anything()
            );
        });
    });

    describe('Desire: ASCEND (Tier Upgrades)', () => {
        it('should NOT trigger UPGRADE if any required resource is missing', () => {
            settlement.stockpile.Timber = 0;
            settlement.stockpile.Stone = 1000;
            settlement.population = 200; // Cap reached

            controller.update(state, TEST_CONFIG);

            expect(settlement.tier).toBe(0);
        });
    });

    describe('Desire: COMMERCIAL (Trade)', () => {
        it('should trigger TRADE when holding massive surplus', () => {
            // Setup a neighbor to trade with
            const neighbor = { ...settlement, id: 'neighbor', ownerId: 'player_2', hexId: '0,2', stockpile: { ...settlement.stockpile, Gold: 1000 } };
            // Neighbor needs to be able to afford it?
            // neighbor gold 1000.
            // Trade strategy checks strict gold.
            state.settlements['neighbor'] = neighbor;

            settlement.stockpile.Timber = 5000; // Massive surplus
            settlement.stockpile.Gold = 0; // Needs gold? Commercial logic is buy OR sell.
            settlement.stockpile.Stone = 0; // Prevent Upgrade (needs 150) so we focus on Trade

            controller.update(state, TEST_CONFIG);

            // Expect CaravanSystem.dispatch to be called
            expect(CaravanSystem.dispatch).toHaveBeenCalled();
        });

        it('should trigger TRADE to buy TOOLS when Gold is high', () => {
            // Setup a neighbor with Tools
            const neighbor = {
                ...settlement,
                id: 'neighbor_tools',
                ownerId: 'player_2',
                hexId: '0,2',
                stockpile: { ...settlement.stockpile, Tools: 500, Gold: 0 }
            };
            state.settlements['neighbor_tools'] = neighbor;

            // We have Gold for payment, but trigger comes from Resources
            settlement.tier = 2; // City (Max Tier) to prevent UPGRADE goal
            settlement.stockpile.Gold = 1000;
            settlement.stockpile.Tools = 0;
            settlement.stockpile.Timber = 500; // Surplus (Trigger)
            settlement.stockpile.Ore = 500; // Surplus (Trigger)

            controller.update(state, TEST_CONFIG);

            expect(CaravanSystem.dispatch).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                '0,2', // Target
                'TRADE',
                expect.anything(),
                expect.objectContaining({ resource: 'Tools' }) // Context should specify Tools
            );
        });
    });

    describe('Desire: EXPAND (Strategic)', () => {
        it('should trigger EXPAND (Spawn Settler) if a missing resource is found within 5 hexes', () => {
            // Make current settlement missing Stone
            settlement.stockpile.Stone = 0;
            // Ensure we have '0,2' (Hills/Stone) in map (already in beforeEach)
            // We need to ensure we have pop/resources to build settler
            settlement.population = 500;
            settlement.stockpile.Food = 1000;
            settlement.stockpile.Timber = 1000;

            controller.update(state, TEST_CONFIG);

            // Expect CaravanSystem.spawn with type 'Settler'
            expect(CaravanSystem.spawn).toHaveBeenCalledWith(
                expect.anything(),
                settlement.hexId,
                '0,2', // Target Stone
                'Settler',
                expect.anything()
            );
        });
    });

    // 2. INTEGRATION TEST
    describe('Integration: Conflict Resolution', () => {
        it('should choose GATHER_FOOD (SURVIVE) over EXPAND when Food is critical', () => {
            // High Expand Potential
            settlement.population = 1000;
            settlement.stockpile.Timber = 1000;
            settlement.stockpile.Stone = 0; // Missing Stone -> High Expand Desire
            // Map has Stone at 0,2 (distance 2)

            // Critical Food Situation
            settlement.stockpile.Food = 0; // SURVIVE = 1.0

            controller.update(state, TEST_CONFIG);

            // Should prioritize Villager (Food) over Settler
            expect(VillagerSystem.spawnVillager).toHaveBeenCalled();
            expect(CaravanSystem.spawn).not.toHaveBeenCalled();
        });
    });
});
