
import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, HexCell, Faction } from '../types/WorldTypes';
import { UpgradeSystem } from '../simulation/systems/UpgradeSystem';
import { HexUtils } from '../utils/HexUtils';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Territory Expansion', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 0,
            map: {},
            settlements: {},
            agents: {},
            factions: {
                'p1': { id: 'p1', name: 'Player 1', color: 'blue' } as Faction,
                'p2': { id: 'p2', name: 'Player 2', color: 'red' } as Faction
            },
            width: 10,
            height: 10
        } as any;
    });

    it('should respect First Come First Serve ownership', () => {
        // Setup Map: 3 hexes in a line: A(0,0) - B(1,0) - C(2,0)
        // Settlement 1 at A, Settlement 2 at C. B is the contested middle ground.

        const hexA = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell;
        const hexB = { id: '1,0', coordinate: { q: 1, r: -1, s: 0 }, terrain: 'Plains', ownerId: null, resources: {} } as HexCell; // Unowned middle
        const hexC = { id: '2,0', coordinate: { q: 2, r: -2, s: 0 }, terrain: 'Plains', ownerId: 'p2', resources: {} } as HexCell;

        state.map['0,0'] = hexA;
        state.map['1,0'] = hexB;
        state.map['2,0'] = hexC;

        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', tier: 0,
            stockpile: { Timber: 1000, Stone: 1000, Ore: 1000, Food: 1000, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], population: 100,
            name: 'Settlement 1'
        } as any;

        const s2: Settlement = {
            id: 's2', ownerId: 'p2', hexId: '2,0', tier: 0,
            stockpile: { Timber: 1000, Stone: 1000, Ore: 1000, Food: 1000, Tools: 0, Gold: 0 },
            controlledHexIds: ['2,0'], population: 100,
            name: 'Settlement 2'
        } as any;

        state.settlements['s1'] = s1;
        state.settlements['s2'] = s2;

        // Upgrade S1 -> Town (Radius 2). Should claim B (Radius 1 from A).
        UpgradeSystem.performUpgradeToTown(state, s1, DEFAULT_CONFIG);

        // Expect B to be owned by p1
        expect(state.map['1,0'].ownerId).toBe('p1');
        expect(s1.controlledHexIds).toContain('1,0');

        // Upgrade S2 -> Town (Radius 2). Should NOT claim B, because it's owned by p1.
        UpgradeSystem.performUpgradeToTown(state, s2, DEFAULT_CONFIG);

        // Expect B to STILL be owned by p1
        expect(state.map['1,0'].ownerId).toBe('p1');

        // Expect S2 to NOT contain B
        expect(s2.controlledHexIds).not.toContain('1,0');
    });
});
