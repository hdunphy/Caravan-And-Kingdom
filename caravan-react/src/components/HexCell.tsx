import React from 'react';
import { HexCell as HexCellType } from '../types/WorldTypes';
import { HexUtils } from '../utils/HexUtils';

import { Hammer, AlertTriangle } from 'lucide-react';

interface Props {
    cell: HexCellType;
    size: number;
    isSelected?: boolean | undefined;
    isHighlighted?: boolean | undefined;
    ownerColor?: string | undefined; // NEW: Color of the owner (if controlled)
    hasBuilding?: boolean;
    isBroken?: boolean;
    onClick?: () => void;
}

const TERRAIN_COLORS: Record<string, string> = {
    Plains: '#86efac', // green-300
    Forest: '#166534', // green-800
    Hills: '#d1d5db', // gray-300
    Mountains: '#4b5563', // gray-600
    Water: '#3b82f6'   // blue-500
};

export const HexCell: React.FC<Props> = ({ cell, size, isSelected, isHighlighted, ownerColor, hasBuilding, isBroken, onClick }) => {
    const { x, y } = HexUtils.hexToPixel(cell.coordinate, size);

    // ... points calculation ...
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const px = size * Math.cos(angle_rad);
        const py = size * Math.sin(angle_rad);
        points.push(`${px},${py}`);
    }

    // Border Logic:
    // Selected: White, Thick
    // Owner: Faction Color, Medium
    // Default: Dark Grey, Thin
    const strokeColor = isSelected ? '#ffffff' : ownerColor ? ownerColor : '#1f2937';
    const strokeWidth = isSelected ? 3 : ownerColor ? 2 : 1;

    return (
        <g transform={`translate(${x + 400}, ${y + 300})`} onClick={onClick}>
            {/* Base Hex */}
            <polygon
                points={points.join(' ')}
                fill={TERRAIN_COLORS[cell.terrain] || '#000'}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className={`transition-all duration-200 cursor-pointer ${isHighlighted ? 'opacity-100' : 'hover:opacity-90'}`}
            />

            {/* Owner Overlay (Optional tint?) */}
            {ownerColor && (
                <polygon
                    points={points.join(' ')}
                    fill={ownerColor}
                    stroke="none"
                    className="pointer-events-none opacity-20"
                />
            )}

            {/* Building Indicator */}
            {hasBuilding && (
                <foreignObject x={-6} y={-6} width={12} height={12} className="pointer-events-none">
                    <div className={`flex items-center justify-center w-full h-full ${isBroken ? 'text-red-600' : 'text-slate-800'}`}>
                        {isBroken ? <AlertTriangle size={10} fill="currentColor" /> : <Hammer size={10} fill="currentColor" />}
                    </div>
                </foreignObject>
            )}

            {/* Highlight Overlay (for controlled territory) */}
            {isHighlighted && (
                <polygon
                    points={points.join(' ')}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    className="pointer-events-none opacity-60"
                />
            )}

            {/* Debug Coord / Terrain Label - Only if no building or specific mode? */}
            {!hasBuilding && (
                <text x="0" y="4" textAnchor="middle" fontSize="10" fill="#000" className="pointer-events-none select-none opacity-50">
                    {cell.terrain[0]}
                </text>
            )}
        </g>
    );
};
