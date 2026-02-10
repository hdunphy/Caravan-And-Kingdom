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

export const Pathfinding = {
    findPath(start: HexCoordinate, end: HexCoordinate, map: Record<string, HexCell>, config?: GameConfig): HexCoordinate[] | null {
        const startId = HexUtils.getID(start);
        const endId = HexUtils.getID(end);

        // Default costs if config is missing (fallback)
        const costs = config?.costs.terrain || {
            Plains: 1,
            Forest: 2,
            Hills: 3,
            Mountains: 6,
            Water: 999
        };

        if (startId === endId) return [];

        // If target is water, can we go there?
        // If config provided, water cost is likely reachable (e.g. 1 or 5). 
        // If not provided, it defaults to 999 (Impassable).
        // Let's assume if cost < 999 it is passable.
        const endCell = map[endId];
        if (!endCell) return null;

        const endCost = costs[endCell.terrain];
        if (endCost >= 999) return null; // Target invalid

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
                return path.reverse().slice(1); // Remove start node
            }

            closedSet.add(current.id);

            const neighbors = HexUtils.getNeighbors(current.coord);
            for (const neighborCoord of neighbors) {
                const neighborId = HexUtils.getID(neighborCoord);
                const neighborCell = map[neighborId];

                if (!neighborCell || closedSet.has(neighborId)) continue;

                const cost = costs[neighborCell.terrain];
                if (cost >= 999) continue;

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

        return null; // No path found
    }
};
