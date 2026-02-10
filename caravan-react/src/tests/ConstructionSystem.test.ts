import { describe, it, expect, beforeEach } from 'vitest';
import { ConstructionSystem } from '../simulation/systems/ConstructionSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('ConstructionSystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 'test-settlement',
            name: 'Test City',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 100,
            stockpile: { Food: 1000, Timber: 1000, Stone: 1000, Ore: 1000, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 1,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0', '1,0'],
            buildings: []
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'player_1', resources: {} }
            },
            settlements: { 'test-settlement': settlement },
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: '#0000ff' }
            },
            width: 10,
            height: 10
        };
    });

    it('should build a building when requirements are met', () => {
        const result = ConstructionSystem.build(state, 'test-settlement', 'GathererHut', '0,0', DEFAULT_CONFIG);
        expect(result).toBe(true);
        expect(settlement.buildings.length).toBe(1);
        expect(settlement.buildings[0].type).toBe('GathererHut');
        expect(settlement.stockpile.Timber).toBeLessThan(1000);
    });

    it('should not build if hex is not controlled', () => {
        const result = ConstructionSystem.build(state, 'test-settlement', 'GathererHut', '5,5', DEFAULT_CONFIG);
        expect(result).toBe(false);
    });

    it('should not build if tier is too low', () => {
        settlement.tier = 0;
        const result = ConstructionSystem.build(state, 'test-settlement', 'Warehouse', '0,0', DEFAULT_CONFIG);
        expect(result).toBe(false);
    });

    it('should not build if hex already has a building', () => {
        ConstructionSystem.build(state, 'test-settlement', 'GathererHut', '0,0', DEFAULT_CONFIG);
        const result = ConstructionSystem.build(state, 'test-settlement', 'GathererHut', '0,0', DEFAULT_CONFIG);
        expect(result).toBe(false);
    });
});
