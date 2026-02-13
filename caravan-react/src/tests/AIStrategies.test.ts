import { describe, it, expect, beforeEach } from 'vitest';
import { ConstructionStrategy } from '../simulation/ai/ConstructionStrategy';
import { UpgradeStrategy } from '../simulation/ai/UpgradeStrategy';
import { TradeStrategy } from '../simulation/ai/TradeStrategy';
import { ExpansionStrategy } from '../simulation/ai/ExpansionStrategy';
import { RecruitStrategy } from '../simulation/ai/RecruitStrategy';
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
    TEST_CONFIG.ai.utility.expandMinDistance = 1;
    TEST_CONFIG.ai.utility.expandSearchRadius = 10;
    TEST_CONFIG.costs.logistics.tradeRoiThreshold = 1;
    TEST_CONFIG.costs.logistics.freightThreshold = 1;

    describe('ConstructionStrategy', () => {
        const strategy = new ConstructionStrategy();

        it('should recommend building GathererHut if food is low', () => {
            settlement.stockpile.Food = 0; // Trigger survive logic
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            const buildAction = actions.find(a => a.type === 'BUILD' && a.buildingType === 'GathererHut');
            expect(buildAction).toBeDefined();
            expect(buildAction!.score).toBeGreaterThan(0.5);
        });

    });

    describe('UpgradeStrategy', () => {
        const strategy = new UpgradeStrategy();

        it('should recommend upgrade when materials and population met', () => {
            settlement.population = 500;
            settlement.stockpile.Timber = 1000;
            settlement.stockpile.Stone = 1000;
            settlement.stockpile.Tools = 100;
            settlement.currentGoal = 'UPGRADE'; // AIStrategies test needs manual goal setting since Governor isn't running

            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            const upgradeAction = actions.find(a => a.type === 'UPGRADE_SETTLEMENT');
            expect(upgradeAction).toBeDefined();
        });
    });

    describe('RecruitStrategy', () => {
        const strategy = new RecruitStrategy();

        it('should recommend recruiting when population supports more villagers', () => {
            // popRatio 10, pop 100 => 10 villagers. Current 0.
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            const recruitAction = actions.find(a => a.type === 'RECRUIT_VILLAGER');
            expect(recruitAction).toBeDefined();
            expect(recruitAction!.score).toBeGreaterThan(0);
        });
    });

    describe('TradeStrategy', () => {
        const strategy = new TradeStrategy();

        it('should recommend trade if surplus exists and neighbor needs it', () => {
            settlement.stockpile.Food = 2000; // Surplus
            const neighbor: Settlement = {
                ...settlement,
                id: 's2',
                hexId: '1,0',
                stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 100 }
            };
            state.settlements['s2'] = neighbor;

            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1', 's1');
            const tradeAction = actions.find(a => a.type === 'DISPATCH_CARAVAN' && a.mission === 'TRADE');
            expect(tradeAction).toBeDefined();
        });
    });

    describe('ExpansionStrategy', () => {
        const strategy = new ExpansionStrategy();

        it('should recommend spawning settler when missing resource is nearby', () => {
            settlement.stockpile.Stone = 0;
            state.map['2,0'] = { id: '2,0', coordinate: { q: 2, r: 0, s: -2 }, terrain: 'Hills', resources: { Stone: 100 }, ownerId: null };

            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            const expandAction = actions.find(a => a.type === 'SPAWN_SETTLER');
            expect(expandAction).toBeDefined();
            expect(expandAction!.targetHexId).toBe('2,0');
        });

        it('should NOT recommend spawning settler if resources below expansion buffer', () => {
            // Cost = 500 Food, 200 Timber. Buffer = 1.5. Required = 750 Food, 300 Timber.
            settlement.stockpile.Timber = 250;
            const actions = strategy.evaluate(state, TEST_CONFIG, 'p1');
            expect(actions.filter(a => a.type === 'SPAWN_SETTLER').length).toBe(0);
        });
    });
});
