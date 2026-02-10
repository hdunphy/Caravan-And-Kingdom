import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinding } from '../simulation/Pathfinding';
import { WorldState, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Pathfinding', () => {
    let map: Record<string, HexCell>;

    beforeEach(() => {
        map = {
            '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: null, resources: {} },
            '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: null, resources: {} },
            '2,0': { id: '2,0', coordinate: { q: 2, r: 0, s: -2 }, terrain: 'Plains', ownerId: null, resources: {} },
            '0,1': { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: null, resources: {} },
            '1,1': { id: '1,1', coordinate: { q: 1, r: 1, s: -2 }, terrain: 'Plains', ownerId: null, resources: {} }
        };
    });

    it('should find a simple path between adjacent hexes', () => {
        const path = Pathfinding.findPath(map['0,0'].coordinate, map['1,0'].coordinate, map, DEFAULT_CONFIG);
        expect(path).not.toBeNull();
        expect(path?.length).toBe(1);
        expect(path?.[0].q).toBe(1);
    });

    it('should avoid impassable terrain (Water with high cost)', () => {
        // Block 1,0 with water
        map['1,0'].terrain = 'Water';
        
        // Path from 0,0 to 2,0
        // Neighbors of 0,0 are 1,0 and 0,1 and -1,1 etc.
        // Neighbors of 2,0 are 1,0 and 2,-1 etc.
        // There should be a path through 0,1 -> 1,1 -> 2,0 if they exist
        map['2,1'] = { id: '2,1', coordinate: { q: 2, r: 1, s: -3 }, terrain: 'Plains', ownerId: null, resources: {} };
        
        const path = Pathfinding.findPath(map['0,0'].coordinate, map['2,0'].coordinate, map, DEFAULT_CONFIG);
        
        expect(path).not.toBeNull();
        // Should not contain 1,0
        expect(path?.some(p => p.q === 1 && p.r === 0)).toBe(false);
    });

    it('should return null if no path exists', () => {
        const path = Pathfinding.findPath(map['0,0'].coordinate, { q: 10, r: 10, s: -20 }, map, DEFAULT_CONFIG);
        expect(path).toBeNull();
    });

    it('should return null if target is water (impassable)', () => {
        map['2,0'].terrain = 'Water';
        const path = Pathfinding.findPath(map['0,0'].coordinate, map['2,0'].coordinate, map, DEFAULT_CONFIG);
        expect(path).toBeNull();
    });
});
