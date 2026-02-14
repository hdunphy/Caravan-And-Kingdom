
import { describe, it, expect } from 'vitest';
import { WorldState } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { AIController } from '../simulation/ai/AIController';

describe('Deadlock Fix Verification', () => {
    it('should recruit villagers when resources are available using base count', () => {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GameConfig;
        config.costs.villagers.baseVillagers = 6;
        config.costs.villagers.popRatio = 25;

        const state: WorldState = {
            factions: {
                'player_1': {
                    id: 'player_1',
                    name: 'Player',
                    color: '#00ccff',
                    gold: 100,
                    blackboard: {
                        factionId: 'player_1',
                        stances: { expand: 0.5, exploit: 0.5 },
                        criticalShortages: [],
                        targetedHexes: [],
                        desires: []
                    },
                    stats: { totalTrades: 0, tradeResources: {}, settlersSpawned: 0, settlementsFounded: 0 },
                    jobPool: undefined
                }
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Testville',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 200, // Should allow 8 agents (200/25)
                    tier: 0,
                    integrity: 100,
                    stockpile: { Food: 2000, Timber: 2000, Stone: 2000, Ore: 0, Tools: 0, Gold: 0 },
                    buildings: [],
                    controlledHexIds: ['0,0'],
                    jobCap: 100,
                    workingPop: 100,
                    availableVillagers: 6, // Currently 6
                    unreachableHexes: {},
                    lastGrowth: 0,
                    popHistory: [],
                    role: 'GENERAL',
                    aiState: { surviveMode: false, savingFor: null, focusResources: [] }
                }
            },
            agents: {},
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: { Food: 100 }, neighborIds: [] }
            },
            tick: 0,
            width: 10,
            height: 10,
            rng: Math.random
        } as any; // Cast to any to avoid strict type checks on partial mocks

        const controller = new AIController();

        // Mock SettlementGovernor? No, we want integration.
        // We need to ensure jobPool is initialized.

        // Run Logic
        controller.update(state, config);

        const s1 = state.settlements['s1'];
        expect(s1.availableVillagers).toBeGreaterThan(6);
    });

    it('should upgrade settlement instantly when resources are available', () => {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GameConfig;

        const state: WorldState = {
            factions: {
                'player_1': {
                    id: 'player_1',
                    name: 'Player',
                    color: '#00ccff',
                    gold: 100,
                    blackboard: {
                        factionId: 'player_1',
                        stances: { expand: 0.5, exploit: 0.5 },
                        criticalShortages: [],
                        targetedHexes: [],
                        desires: []
                    },
                    stats: { totalTrades: 0, tradeResources: {}, settlersSpawned: 0, settlementsFounded: 0 },
                    jobPool: undefined
                }
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Testville',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 200, // Needs 100 for T1
                    tier: 0,
                    integrity: 100,
                    stockpile: { Food: 2000, Timber: 2000, Stone: 2000, Ore: 0, Tools: 0, Gold: 0 },
                    buildings: [],
                    controlledHexIds: ['0,0'],
                    jobCap: 100,
                    workingPop: 100,
                    availableVillagers: 6,
                    unreachableHexes: {},
                    lastGrowth: 0,
                    popHistory: [],
                    role: 'GENERAL',
                    aiState: { surviveMode: false, savingFor: null, focusResources: [] }
                }
            },
            agents: {},
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: { Food: 100 }, neighborIds: [] }
            },
            tick: 0,
            width: 10,
            height: 10,
            rng: Math.random
        } as any;

        const controller = new AIController();
        controller.update(state, config);

        const s1 = state.settlements['s1'];
        expect(s1.tier).toBe(1);
    });

    it('should build smithy instantly when resources are available', () => {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GameConfig;

        const state: WorldState = {
            factions: {
                'player_1': {
                    id: 'player_1',
                    name: 'Player',
                    color: '#00ccff',
                    gold: 100,
                    blackboard: {
                        factionId: 'player_1',
                        stances: { expand: 0.5, exploit: 0.5 },
                        criticalShortages: [],
                        targetedHexes: [],
                        desires: []
                    },
                    stats: { totalTrades: 0, tradeResources: {}, settlersSpawned: 0, settlementsFounded: 0 },
                    jobPool: undefined
                }
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Smithville',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 100,
                    tier: 1, // Must be T1 for Smithy
                    integrity: 100,
                    stockpile: { Food: 2000, Timber: 2000, Stone: 2000, Ore: 2000, Tools: 0, Gold: 0 },
                    buildings: [],
                    controlledHexIds: ['0,0'],
                    jobCap: 100,
                    workingPop: 100,
                    availableVillagers: 6,
                    unreachableHexes: {},
                    lastGrowth: 0,
                    popHistory: [],
                    role: 'MINING', // Increases desire
                    aiState: { surviveMode: false, savingFor: null, focusResources: [] }
                }
            },
            agents: {},
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: { Food: 100 }, neighborIds: [] }
            },
            tick: 0,
            width: 10,
            height: 10,
            rng: Math.random
        } as any;

        const controller = new AIController();
        controller.update(state, config);

        const s1 = state.settlements['s1'];
        expect(s1.buildings).toContain('SMITHY');
    });
});
