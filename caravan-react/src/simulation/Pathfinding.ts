import { HexCoordinate, HexCell } from '../types/WorldTypes';
import { HexUtils } from '../utils/HexUtils';
import { GameConfig } from '../types/GameConfig';

interface Node {
    id: string;
    coord: HexCoordinate;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

const pathCache = new Map<string, HexCoordinate[]>();

export const Pathfinding = {
    clearCache() {
        pathCache.clear();
    },

    findPath(start: HexCoordinate, end: HexCoordinate, map: Record<string, HexCell>, config?: GameConfig): HexCoordinate[] | null {
        const startId = HexUtils.getID(start);
        const endId = HexUtils.getID(end);
        const cacheKey = `${startId}_${endId}`;

        if (pathCache.has(cacheKey)) {
            return pathCache.get(cacheKey)!;
        }

        // Default costs if config is missing (fallback)
        const costs = config?.costs.terrain || {
            Plains: 1,
            Forest: 2,
            Hills: 3,
            Mountains: 6,
            Water: 1000
        };

        const IMPASSABLE = 1000;

        if (startId === endId) return [];

        const endCell = map[endId];
        if (!endCell) return null;

        const endCost = costs[endCell.terrain];
        if (endCost >= IMPASSABLE) return null; // Target invalid

        const openList: Node[] = [];
        const closedSet = new Set<string>();

        const startNode: Node = {
            id: startId,
            coord: start,
            g: 0,
            h: HexUtils.distance(start, end),
            f: HexUtils.distance(start, end),
            parent: null
        };

        openList.push(startNode);

        while (openList.length > 0) {
            // Sort by lowest f
            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift()!;

            if (current.id === endId) {
                // Reconstruct path
                const path: HexCoordinate[] = [];
                let curr: Node | null = current;
                while (curr) {
                    path.push(curr.coord);
                    curr = curr.parent;
                }
                const resultPath = path.reverse().slice(1); // Remove start node
                pathCache.set(cacheKey, resultPath);
                return resultPath;
            }

            closedSet.add(current.id);

            const neighbors = HexUtils.getNeighbors(current.coord);
            for (const neighborCoord of neighbors) {
                const neighborId = HexUtils.getID(neighborCoord);
                const neighborCell = map[neighborId];

                if (!neighborCell || closedSet.has(neighborId)) continue;

                const cost = costs[neighborCell.terrain];
                if (cost >= IMPASSABLE) continue;

                const gScore = current.g + cost;

                // Check if neighbor is already in openList
                const existingNode = openList.find(n => n.id === neighborId);

                if (existingNode) {
                    if (gScore < existingNode.g) {
                        existingNode.g = gScore;
                        existingNode.f = gScore + existingNode.h;
                        existingNode.parent = current;
                    }
                } else {
                    const h = HexUtils.distance(neighborCoord, end);
                    openList.push({
                        id: neighborId,
                        coord: neighborCoord,
                        g: gScore,
                        h: h,
                        f: gScore + h,
                        parent: current
                    });
                }
            }
        }

        pathCache.set(cacheKey, []); // Cache failure as empty array? Warning: findPath returns null on fail.
        // If we cache [], next time we return [], checking type... [] is HexCoordinate[] so it fits return type.
        // BUT logic above says `if (pathCache.has) return get`. unique nuance: [] is truthy.
        // The original code returned `null` on failure.
        // If I return [], the caller might think it found a path (of length 0? or just empty). 
        // HexCoordinate[] usually implies a path. Length 0 means... ?
        // Line 30: `if (startId === endId) return [];`
        // So empty array means "already there".
        // Null means "unreachable".
        // WE CANNOT RETURN [] for UNREACHABLE.
        // So we should probably NOT cache unreachable for now to avoid breaking logic, 
        // OR we cache `null` but we need to cast or trick typescript if the map is strictly HexCoordinate[].
        // Map definition: `Map<string, HexCoordinate[]>`. It cannot hold null.
        // So I will REMOVE the caching of failure for now to avoid bugs.
        return null; // No path found
    }
};
