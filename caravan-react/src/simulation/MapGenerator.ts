import { HexCell, TerrainType } from '../types/WorldTypes.ts';
import { HexUtils } from '../utils/HexUtils.ts';

export const MapGenerator = {
    generate(width: number, height: number): Record<string, HexCell> {
        const map: Record<string, HexCell> = {};

        // Generate normalized axial coordinates for a roughly rectangular grid
        // Or just a parallelogram for simplicity first
        for (let r = 0; r < height; r++) {
            for (let q = 0; q < width; q++) {
                // Offset to make it more rectangular if desired, but standard axial is rhombus.
                // Let's stick to simple axial q,r for now within range.
                // Actually, with offset coords, conversion is needed. 
                // Let's just generate a 10x10 rhombus for simplicity in Milestone 1.

                // Wait, "Offset coordinates" are better for rectangular display.
                // Let's generate using "odd-r" offset coordinates logic then convert to axial.

                const q_axial = q - Math.floor(r / 2);
                const r_axial = r;

                const coord = HexUtils.create(q_axial, r_axial);
                const cell: HexCell = {
                    id: HexUtils.getID(coord),
                    coordinate: coord,
                    terrain: this.getRandomTerrain(),
                    ownerId: null,
                    resources: {}
                };
                map[cell.id] = cell;
            }
        }
        return map;
    },

    getRandomTerrain(): TerrainType {
        const rand = Math.random();
        if (rand < 0.3) return 'Plains';
        if (rand < 0.5) return 'Forest';
        if (rand < 0.7) return 'Hills';
        if (rand < 0.85) return 'Mountains';
        return 'Water';
    },

    findStartingLocation(map: Record<string, HexCell>, _width: number, _height: number, config: any, existingSettlements: any[]): HexCell | null {
        // Try random locations carefully? Or scan? 
        // Randomized search with max attempts is safer than full scan if map is huge, 
        // but for 20x20 (400) full scan is instant.

        const candidates = Object.values(map);
        // Shuffle for randomness
        candidates.sort(() => Math.random() - 0.5);

        const requiredFood = (config.yields.Plains.Food || 1) * 3;

        for (const cell of candidates) {
            // 1. Not Water
            if (cell.terrain === 'Water') continue;
            // CHECK RULE: Not Controlled by anyone
            if (cell.ownerId) continue; // Can't steal

            // 2. Bounds Check (Range 3 inner)
            // If we are too close to edge, we can't expand range 3.
            // Map generation logic: q goes 0..width, r goes 0..height (offset).
            // This relies on knowing the grid bounds.
            // Let's assume we want to stay `range` away from min/max q/r?
            // With HexUtils, we can just check if all Spiral(3) neighbors exist in map.
            const cityRange = 3;
            const spiral = HexUtils.getSpiral(cell.coordinate, cityRange);
            const allInBounds = spiral.every(c => map[HexUtils.getID(c)]);
            if (!allInBounds) continue;

            // 3. Distance from others
            const tooClose = existingSettlements.some(s => {
                const sHex = map[s.hexId];
                if (!sHex) return false;
                return HexUtils.distance(cell.coordinate, sHex.coordinate) <= cityRange;
            });
            if (tooClose) continue;

            // 4. Resources in Range 1
            const innerRing = HexUtils.getSpiral(cell.coordinate, 1);
            let totalFood = 0;
            let totalTimber = 0;
            let totalStone = 0;

            innerRing.forEach(c => {
                const h = map[HexUtils.getID(c)];
                if (h) {
                    const y = config.yields[h.terrain];
                    if (y) {
                        totalFood += y.Food || 0;
                        totalTimber += y.Timber || 0;
                        totalStone += y.Stone || 0;
                    }
                }
            });

            if (totalFood >= requiredFood && totalTimber > 0 && totalStone > 0) {
                return cell;
            }
        }

        return null;
    },

    findExpansionLocation(map: Record<string, HexCell>, _width: number, _height: number, config: any, existingSettlements: any[]): HexCell | null {
        // Relaxed Rules:
        // 1. Not Water
        // 2. Fits Village (Range 1) inside bounds
        // 3. Food >= 1.5 * Plains
        // 4. Dist > 3 from others (to prevent overlap)

        const candidates: HexCell[] = [];
        const requiredFood = (config.yields.Plains.Food || 1) * 1.5;
        // const villageRange = 2; // Unused for now
        // Wait, "Fits village" means neighbor checks. "Distance" means settlement distance.

        // Scan random sample or full scan? 20x20 is small enough for full scan.
        Object.values(map).forEach(cell => {
            if (cell.terrain === 'Water') return;
            if (existingSettlements.some(s => s.hexId === cell.id)) return; // Occupied

            // Check Bounds (Can we expand to Range 1?)
            const neighbors = HexUtils.getSpiral(cell.coordinate, 1);
            const allInBounds = neighbors.every(c => map[HexUtils.getID(c)]);
            if (!allInBounds) return;

            // Check Distance from others (Range 3 buffer)
            const tooClose = existingSettlements.some(s => {
                const sHex = map[s.hexId];
                if (!sHex) return false;
                return HexUtils.distance(cell.coordinate, sHex.coordinate) <= 2;
            });
            if (tooClose) return;

            // Check Food (Immediate neighbors)
            let totalFood = 0;
            // Center + Neighbors
            neighbors.forEach(c => {
                const h = map[HexUtils.getID(c)];
                if (h && config.yields[h.terrain]) {
                    totalFood += config.yields[h.terrain].Food || 0;
                }
            });

            // Single tile food for quick check or area food? 
            // "has at least 1.5 * plain food". Usually means the tile itself or the catchment.
            // Let's assume catchment (7 hexes) should support a village.
            // 1.5 * Plains (4) = 6.
            // 7 hexes of plains would be 28.
            // So 6 is very low bar. Maybe "Center tile >= 1.5 * Plains"? 
            // Or "Average yield"?
            // Let's interpret "has at least 1.5 * plain food" as "The sum of food in Range 1 >= 1.5 * Single Plains Tile Yield * 7"?
            // No, user likely means "The location is decent".
            // Let's go with: Total Catchment Food >= 1.5 * (Plains.Food). 
            // If Plains.Food is 4. Target is 6.
            // A single Plains tile is 4. Two is 8. So it's very relaxed.

            if (totalFood >= requiredFood) {
                candidates.push(cell);
            }
        });

        // Pick best or random? Heuristic: Pick one with most resources or prioritize missing?
        // For now, random from valid candidates.
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
};
