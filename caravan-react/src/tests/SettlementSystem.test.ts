import { describe, it, expect, beforeEach } from 'vitest';
import { Settlement, WorldState } from '../types/WorldTypes';
import { SettlementSystem } from '../simulation/systems/SettlementSystem';

describe('SettlementSystem', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 0,
            map: {},
            settlements: {},
            agents: {},
            factions: {},
            width: 10,
            height: 10
        };
    });

    describe('Dynamic Settlement Roles', () => {
        it('should assign LUMBER role if >30% Forest', () => {
            const s: Settlement = {
                id: 's1', name: 'Lumber Town', hexId: '0,0', ownerId: 'f1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0', '0,1', '-1,0'], // 4 hexes
                buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['s1'] = s;

            // Mock Map: 2 Forest (50%), 2 Plains
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Forest', ownerId: 'f1', resources: {} };
            state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'f1', resources: {} };
            state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
            state.map['-1,0'] = { id: '-1,0', coordinate: { q: -1, r: 0, s: 1 }, terrain: 'Plains', ownerId: 'f1', resources: {} };

            SettlementSystem.updateRoles(state);

            expect(state.settlements['s1'].role).toBe('LUMBER');
        });

        it('should assign GRANARY role if >50% Plains', () => {
            const s: Settlement = {
                id: 's2', name: 'Farm Town', hexId: '0,0', ownerId: 'f1',
                population: 100, stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 10,
                controlledHexIds: ['0,0', '1,0', '0,1'], // 3 hexes
                buildings: [], popHistory: [],
                role: 'GENERAL'
            };
            state.settlements['s2'] = s;

            // Mock Map: 3 Plains (100%)
            state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
            state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
            state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: {} };

            SettlementSystem.updateRoles(state);

            expect(state.settlements['s2'].role).toBe('GRANARY');
        });
    });
});
