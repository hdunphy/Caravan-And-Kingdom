import { describe, it, expect, beforeEach } from 'vitest';
import { ConstructionStrategy } from '../simulation/ai/ConstructionStrategy';
import { TradeStrategy } from '../simulation/ai/TradeStrategy';
import { ExpansionStrategy } from '../simulation/ai/ExpansionStrategy';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('AI Strategies', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'p1',
            population: 100,
            stockpile: { Food: 1000, Timber: 1000, Stone: 1000, Ore: 1000, Tools: 0, Gold: 100 },
            integrity: 100,
            tier: 1,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0', '1,0'],
            buildings: [],
            popHistory: [],
            unreachableHexes: {},
            role: 'GENERAL'
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'p1', resources: {} }
            },
            settlements: { 's1': settlement },
            agents: {},
            factions: { 'p1': { id: 'p1', name: 'P1', color: '#f00' } },
            width: 10,
            height: 10
        };
    });

    const TEST_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    // Override with test-friendly values
    TEST_CONFIG.ai.utility.surviveThreshold = 10; // Trigger build if < 10 ticks
    TEST_CONFIG.costs.logistics.tradeRoiThreshold = 20; // Trigger trade easily
    TEST_CONFIG.ai.utility.expandSearchRadius = 20;
    TEST_CONFIG.ai.utility.expandMinDistance = 5;

    describe('ConstructionStrategy', () => {
        const strategy = new ConstructionStrategy();

        it('should recommend building GathererHut when food is low', () => {
            // Consumption = 100 * 0.1 = 10. Threshold = 10 * 10 = 100.
            // Set Food to 50. Health = 0.5. Score = 0.5 + 0.2 = 0.7.
            settlement.stockpile.Food = 50;
            settlement.currentGoal = 'SURVIVE';
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions).toContainEqual(expect.objectContaining({ type: 'BUILD', buildingType: 'GathererHut' }));
        });

        it('should not build if resources are below buffer', () => {
            settlement.stockpile.Timber = 0;
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions.length).toBe(0);
        });
    });

    describe('TradeStrategy', () => {
        const strategy = new TradeStrategy();

        it('should recommend trade if there is a deficit and a partner with surplus', () => {
            settlement.currentGoal = 'UPGRADE'; // Force checks for Timber/Stone
            settlement.stockpile.Timber = 0;
            const s2: Settlement = {
                ...settlement,
                id: 's2',
                hexId: '5,5',
                stockpile: { Food: 1000, Timber: 1000, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                controlledHexIds: ['5,5'],
                popHistory: [],
                unreachableHexes: {},
                role: 'GENERAL'
            };
            state.settlements['s2'] = s2;
            state.map['5,5'] = { id: '5,5', coordinate: { q: 5, r: 5, s: -10 }, terrain: 'Forest', ownerId: 'p1', resources: {} };

            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions).toContainEqual(expect.objectContaining({
                type: 'DISPATCH_CARAVAN',
                mission: 'TRADE',
                settlementId: 's1'
            }));
        });
    });

    describe('ExpansionStrategy', () => {
        const strategy = new ExpansionStrategy();

        beforeEach(() => {
            settlement.stockpile = { Food: 1000, Timber: 1000, Stone: 1000, Ore: 1000, Tools: 0, Gold: 100 };
            settlement.currentGoal = 'EXPAND';
            if (!settlement.aiState) {
                settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [], lastSettlerSpawnTick: undefined };
            } else {
                settlement.aiState.lastSettlerSpawnTick = undefined;
            }
            state.tick = 200;
            // Add an unowned hex far away to satisfy distance check
            state.map['10,10'] = { id: '10,10', coordinate: { q: 10, r: 10, s: -20 }, terrain: 'Hills', ownerId: null, resources: {} };
            // Ensure ExpandStrategy scan finds it by making Stone "missing"
            settlement.stockpile.Stone = 0;
            // Ensure distance requirement is met (minDistance is 5.55)
            // Hex (0,0,0) to (10,10,-20) distance is 20.
        });

        it('should recommend spawning settler when resources and cooldown are okay', () => {
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions).toContainEqual(expect.objectContaining({ type: 'SPAWN_SETTLER' }));
        });

        it('should NOT recommend spawning settler during cooldown', () => {
            settlement.aiState!.lastSettlerSpawnTick = 150; // 50 ticks ago
            // Cooldown is 100 in DEFAULT_CONFIG (merged into TEST_CONFIG)
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions.filter(a => a.type === 'SPAWN_SETTLER').length).toBe(0);
        });

        it('should NOT recommend spawning settler if food is below survival reserve', () => {
            // Consumption = 100 * 0.1 = 10. Reserve = 10 * 50 = 500.
            // Cost Food = 500. Total needed = 1000.
            settlement.stockpile.Food = 900;
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions.filter(a => a.type === 'SPAWN_SETTLER').length).toBe(0);
        });

        it('should NOT recommend spawning settler if resources below expansion buffer', () => {
            // Cost = 500 Food, 200 Timber. Buffer = 1.5. Required = 750 Food, 300 Timber.
            settlement.stockpile.Timber = 250;
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions.filter(a => a.type === 'SPAWN_SETTLER').length).toBe(0);
        });
    });
});
