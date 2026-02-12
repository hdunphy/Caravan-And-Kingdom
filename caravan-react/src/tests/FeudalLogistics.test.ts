import { describe, it, expect, beforeEach } from 'vitest';
import { Settlement, WorldState } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';
import { GoalEvaluator } from '../simulation/ai/GoalEvaluator';
import { SettlementSystem } from '../simulation/systems/SettlementSystem';
import { AIController } from '../simulation/ai/AIController';
import { ExpansionStrategy } from '../simulation/ai/ExpansionStrategy';

// Mocks
const mockConfig: GameConfig = {
    ...DEFAULT_CONFIG,
    costs: { ...DEFAULT_CONFIG.costs, baseConsume: 1 },
    ai: { ...DEFAULT_CONFIG.ai, thresholds: { ...DEFAULT_CONFIG.ai.thresholds, surviveFood: 50, surviveTicks: 10 } }
};

describe('Feudal Logistics V4', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 0,
            map: {},
            settlements: {},
            agents: {},
            factions: { 'faction_1': { id: 'faction_1', name: 'Test Faction', color: '#000000' } },
            width: 10,
            height: 10
        };
    });

    describe('Dynamic Settlement Roles', () => {
        it('should assign LUMBER role if >30% Forest', () => {
            const s: Settlement = {
                id: 's1', name: 'Lumber Town', hexId: '0,0', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0', '0,1', '-1,0'], // 4 hexes
                buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['s1'] = s;

            // Mock Map: 2 Forest (50%), 2 Plains
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Forest', ownerId: 'faction_1', resources: {} };
            state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'faction_1', resources: {} };
            state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
            state.map['-1,0'] = { id: '-1,0', coordinate: { q: -1, r: 0, s: 1 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };

            // Run System
            SettlementSystem.updateRoles(state);

            expect(state.settlements['s1'].role).toBe('LUMBER');
        });

        it('should assign GRANARY role if >50% Plains', () => {
            const s: Settlement = {
                id: 's2', name: 'Farm Town', hexId: '0,0', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0', '0,1'], // 3 hexes
                buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['s2'] = s;

            // Mock Map: 3 Plains (100%)
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
            state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
            state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };

            SettlementSystem.updateRoles(state);

            expect(state.settlements['s2'].role).toBe('GRANARY');
        });
    });

    describe('Economic Pacing (THRIFTY)', () => {
        it('should enter THRIFTY state when food is low (e.g. 15 ticks)', () => {
            const s: Settlement = {
                id: 's3', name: 'Thrifty Town', hexId: '0,0', ownerId: 'faction_1',
                population: 10, stockpile: { Food: 150, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: [], buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            // Panic = 100 (10 ticks). Safe = 200 (20 ticks). 
            // 150 is between them.
            state.settlements['s3'] = s;

            const goal = GoalEvaluator.evaluate(state, s, mockConfig);
            expect(goal).toBe('THRIFTY');
        });
    });

    describe('Sovereign AI', () => {
        it('should maintain independent state for each faction', () => {
            const controller = new AIController();

            // Just verify it doesn't crash and initializes states
            controller.update(state, mockConfig);

            // @ts-ignore
            expect(controller['factionStates'].has('faction_1')).toBe(true);
        });
    });

    describe('Internal Logistics', () => {
        it('should create LOGISTICS mission when territory has resources', () => {
            const s: Settlement = {
                id: 's4', name: 'Logistics Hub', hexId: '0,0', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 100, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0'], buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['s4'] = s;

            // Add resources to territory
            state.map['1,0'] = {
                id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'faction_1',
                resources: { Timber: 50 }
            };
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };

            // Run AI Controller (Labor/Transport)
            controller.update(state, mockConfig);

            // Check for Logistics Caravan or Villager Gatherer
            const logisticsAgents = Object.values(state.agents).filter(a =>
                (a.type === 'Caravan' && a.mission === 'LOGISTICS') ||
                (a.type === 'Villager' && a.mission === 'GATHER')
            );

            expect(logisticsAgents.length).toBeGreaterThan(0);
        });
    });

    describe('Role Bonus', () => {
        it('should give higher utility score for role-matching resources', () => {
            const s: Settlement = {
                id: 's_lumber', name: 'Lumber Town', hexId: '0,0', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0'], buildings: [], popHistory: [],
                role: 'LUMBER',
                aiState: { surviveMode: false, savingFor: null, focusResources: ['Timber'] }
            };
            state.settlements['s_lumber'] = s;
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
            state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'faction_1', resources: { Timber: 10 } };

            const bonusActions = controller['hrStrategies'][0].evaluate(state, mockConfig, 'faction_1', 's_lumber');
            const timberAction = bonusActions.find(a => (a.type === 'DISPATCH_VILLAGER' && a.targetHexId === '1,0'));

            // Now check non-lumber
            s.role = 'GENERAL';
            const normalActions = controller['hrStrategies'][0].evaluate(state, mockConfig, 'faction_1', 's_lumber');
            const normalTimberAction = normalActions.find(a => (a.type === 'DISPATCH_VILLAGER' && a.targetHexId === '1,0'));

            expect(timberAction).toBeDefined();
            expect(normalTimberAction).toBeDefined();
            // @ts-ignore
            expect(timberAction.score).toBeGreaterThan(normalTimberAction.score);
        });
    });

    describe('Internal Logistics (Freight)', () => {
        it('should dispatch INTERNAL_FREIGHT villager for non-food resources (Timber)', () => {
            const richTown: Settlement = {
                id: 'rich', name: 'Rich Town', hexId: '0,0', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 600, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 1, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0'], buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            const poorTown: Settlement = {
                id: 'poor', name: 'Poor Town', hexId: '0,1', ownerId: 'faction_1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,1'], buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['rich'] = richTown;
            state.settlements['poor'] = poorTown;
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
            state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };

            // @ts-ignore
            const actions = controller['hrStrategies'][0].evaluate(state, mockConfig, 'faction_1', 'rich');

            const freightAction = actions.find(a =>
                a.type === 'DISPATCH_VILLAGER' &&
                // @ts-ignore
                a.mission === 'INTERNAL_FREIGHT' &&
                // @ts-ignore
                a.payload?.resource === 'Timber'
            );

            expect(freightAction).toBeDefined();
            if (freightAction && freightAction.type === 'DISPATCH_VILLAGER') {
                expect(freightAction.targetHexId).toBe('0,1');
            }
        });
    });
});

// Helper for tests
const controller = new AIController();

describe('Feudal Logistics V4: ExpansionStrategy', () => {
    // Re-use mockConfig but with specific expansion settings
    const expansionConfig = JSON.parse(JSON.stringify(mockConfig));
    expansionConfig.ai.utility = {
        expandSearchRadius: 10,
        expandMinDistance: 1, // Allow closer for testing (dist 2 is valid)
        expandSaturationPower: 1
    };

    it('should propose SPAWN_SETTLER when Stone is missing and Hills are nearby', () => {
        const state: WorldState = {
            tick: 100,
            map: {},
            settlements: {},
            agents: {},
            factions: { 'faction_1': { id: 'faction_1', name: 'Test Faction', color: '#000000' } },
            width: 10,
            height: 10
        };

        const settlement: Settlement = {
            id: 's_expand', name: 'Capital', hexId: '0,0', ownerId: 'faction_1',
            population: 100, stockpile: { Food: 10000, Timber: 1000, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'],
            buildings: [],
            role: 'GENERAL',
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            tier: 0,
            popHistory: [],
            integrity: 100
        } as any;
        state.settlements['s_expand'] = settlement;

        // Map
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'faction_1', resources: {} };
        state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Forest', ownerId: null, resources: { Timber: 100 } };
        // Target: 0,2 (Hills) -> Dist 2. Valid with minDistance 1.
        state.map['0,2'] = { id: '0,2', coordinate: { q: 0, r: 2, s: -2 }, terrain: 'Hills', ownerId: null, resources: { Stone: 100 } };

        // Use ExpansionStrategy directly to verify logic
        const strategy = new ExpansionStrategy();

        const actions = strategy.evaluate(state, expansionConfig, 'faction_1', 's_expand');

        const expandAction = actions.find((a: any) => a.type === 'SPAWN_SETTLER');
        expect(expandAction).toBeDefined();
        if (expandAction && expandAction.type === 'SPAWN_SETTLER') {
            expect(expandAction.targetHexId).toBe('0,2');
        }
    });
});

