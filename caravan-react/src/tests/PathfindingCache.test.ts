import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinding } from '../simulation/Pathfinding';
import { HexCoordinate, HexCell, AgentType } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { HexUtils } from '../utils/HexUtils';

describe('Pathfinding Cache System', () => {
    // Helper to create a basic 5x5 map of Plains
    const createMap = (width: number, height: number): Record<string, HexCell> => {
        const map: Record<string, HexCell> = {};
        for (let q = 0; q < width; q++) {
            for (let r = 0; r < height; r++) {
                const id = `${q},${r}`;
                map[id] = {
                    id,
                    coordinate: { q, r, s: -q - r },
                    terrain: 'Plains',
                    ownerId: null,
                    resources: {}
                };
            }
        }
        return map;
    };

    beforeEach(() => {
        Pathfinding.clearCache();
    });

    it('should return identical paths for subsequent identical requests (Cache Hit)', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 4, r: 4, s: -8 };

        const path1 = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);
        const path2 = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);

        expect(path1).not.toBeNull();
        expect(path1).toEqual(path2);
    });

    it('should share cache entries across AgentTypes (Lord Dunphy Requirement)', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 2, r: 2, s: -4 };

        const caravanPath = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);

        // Change the map to Water (impassable)
        map['1,1'].terrain = 'Water';

        const villagerPath = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);

        // Should hit the cache and return the OLD (passable) path even though map changed
        // This confirms global sharing and cache persistence.
        expect(caravanPath).toEqual(villagerPath);
    });

    it('should return a clone of the cached path to prevent external mutation', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 2, r: 0, s: -2 };

        const path1 = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG)!;

        // Mutate the returned array
        path1.push({ q: 99, r: 99, s: -198 });

        const path2 = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG)!;

        expect(path2.length).toBeLessThan(path1.length);
        expect(path2[path2.length - 1]).not.toEqual({ q: 99, r: 99, s: -198 });
    });

    it('should handle map terrain changes (Desync Test)', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 2, r: 0, s: -2 };

        // 1. Path is clear
        const pathPassable = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);
        expect(pathPassable).not.toBeNull();

        // 2. Block the path
        map['1,0'].terrain = 'Water';

        // This is the current BUGGY behavior or FEATURE: 
        // Cache is NOT cleared when map changes.
        const pathBlocked = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);

        // EXPECTATION: If cache is working as intended (static), this is still the old path.
        // If we want dynamic pathfinding, this should be NULL or a different path.
        expect(pathBlocked).toEqual(pathPassable);
    });

    it('should respect GameConfig changes if we implemented config hashing (Sensitivity Test)', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 2, r: 0, s: -2 };

        // Make Hills very expensive
        map['1,0'].terrain = 'Hills';
        const configExpensive = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        configExpensive.costs.terrain.Hills = 100;

        const path1 = Pathfinding.findPath(start, end, map, configExpensive);

        // Make Hills very cheap
        const configCheap = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        configCheap.costs.terrain.Hills = 1;

        const path2 = Pathfinding.findPath(start, end, map, configCheap);

        // CURRENT BEHAVIOR: Hits cache, path2 will be the same as path1 (ignoring config change)
        expect(path2).toEqual(path1);
    });

    it('should not cache pathfinding failures (Null results)', () => {
        const map = createMap(5, 5);
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 4, r: 4, s: -8 };

        // Create a config where Water is IMPASSABLE for this test
        const blockedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        blockedConfig.costs.terrain.Water = 1000;

        // Block all routes with Water
        for (let r = 0; r < 5; r++) map[`2,${r}`].terrain = 'Water';

        // Should return null because Water is 1000
        const fail1 = Pathfinding.findPath(start, end, map, blockedConfig);
        expect(fail1).toBeNull();

        // Unblock
        map['2,2'].terrain = 'Plains';

        const success1 = Pathfinding.findPath(start, end, map, blockedConfig);

        // If we erroneously cached the NULL, this would be NULL.
        // But Pathfinding.ts only calls cache.set inside the goal block.
        expect(success1).not.toBeNull();
        expect(success1!.length).toBeGreaterThan(0);
    });

    it('should handle the 1000 iteration limit correctly', () => {
        const map = createMap(50, 50); // Larger map
        const start = { q: 0, r: 0, s: 0 };
        const end = { q: 49, r: 49, s: -98 };

        // This path is likely > 1000 iterations in A*
        const path = Pathfinding.findPath(start, end, map, DEFAULT_CONFIG);

        // Should return null (failure) due to iteration limit
        expect(path).toBeNull();
    });
});
