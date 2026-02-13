import { HexCoordinate, HexCell } from '../types/WorldTypes.ts';
import { HexUtils } from '../utils/HexUtils.ts';
import { GameConfig } from '../types/GameConfig.ts';
import { Logger } from '../utils/Logger.ts';

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
        
        // Factions share the same path cache for efficiency (Lord Dunphy's Request)
        const cacheKey = `${startId}_${endId}`;

        if (pathCache.has(cacheKey)) {
            return [...pathCache.get(cacheKey)!];
        }

        // Default costs if config is missing (fallback)
        const costs = {
            ...(config?.costs.terrain || {
                Plains: 1,
                Forest: 2,
                Hills: 3,
                Mountains: 6,
                Water: 1000
            })
        };

        const IMPASSABLE = 1000;

        // Ensure Water is impassable regardless of config overrides for now
        costs.Water = IMPASSABLE;

        if (startId === endId) return [];

        const endCell = map[endId];
        if (!endCell) {
            Logger.getInstance().log(`[Pathfinding] Fail: Target ${endId} does not exist in map.`);
            return null;
        }

        const endCost = costs[endCell.terrain];
        if (endCost >= IMPASSABLE) {
            Logger.getInstance().log(`[Pathfinding] Fail: Target ${endId} is impassable (${endCell.terrain}).`);
            return null; // Target invalid
        }

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

        let iterations = 0;
        while (openList.length > 0) {
            iterations++;
            if (iterations > 1000) {
                Logger.getInstance().log(`[Pathfinding DEBUG] FAIL: Pathfinding exceeded 1000 iterations for ${startId} -> ${endId}`);
                break;
            }
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

                if (resultPath.length === 0) {
                    Logger.getInstance().log(`[Pathfinding DEBUG] CRITICAL: Reconstructed EMPTY path for ${startId} -> ${endId}! Path length before slice was ${path.length}. GoalNode ID: ${current.id}, Parent ID: ${current.parent?.id}`);
                } else {
                    // Logger.getInstance().log(`[Pathfinding DEBUG] Found path ${startId} -> ${endId}. Length: ${resultPath.length}`);
                }

                pathCache.set(cacheKey, resultPath);
                return [...resultPath];
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

        // No path found
        Logger.getInstance().log(`[Pathfinding] Fail: Search exhausted for ${startId} to ${endId}. ClosedSet size: ${closedSet.size}`);
        return null;
    }
};
