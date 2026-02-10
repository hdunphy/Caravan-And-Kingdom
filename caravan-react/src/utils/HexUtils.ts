import { HexCoordinate } from '../types/WorldTypes';

export const HexUtils = {
    // Create a coordinate
    create(q: number, r: number): HexCoordinate {
        return { q, r, s: -q - r };
    },

    // Get ID string
    getID(hex: HexCoordinate): string {
        return `${hex.q},${hex.r}`;
    },

    // Get neighbors (Axial directions)
    getNeighbors(hex: HexCoordinate): HexCoordinate[] {
        const directions = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
        ];
        return directions.map(d => HexUtils.create(hex.q + d.q, hex.r + d.r));
    },

    // Distance between two hexes
    distance(a: HexCoordinate, b: HexCoordinate): number {
        return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
    },

    // Convert Hex to Pixel (Pointy Top)
    hexToPixel(hex: HexCoordinate, size: number): { x: number, y: number } {
        const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
        const y = size * (3 / 2 * hex.r);
        return { x, y };
    },
    // Get all hexes within a certain radius (N rings)
    getSpiral(center: HexCoordinate, radius: number): HexCoordinate[] {
        const results: HexCoordinate[] = [];
        for (let q = -radius; q <= radius; q++) {
            for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
                results.push(HexUtils.create(center.q + q, center.r + r));
            }
        }
        return results;
    }
};
