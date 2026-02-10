import React, { useState, useRef } from 'react';
import { WorldState, Settlement, AgentEntity } from '../types/WorldTypes';
import { HexUtils } from '../utils/HexUtils';
import { HexCell } from './HexCell';
import { SettlementTooltip } from './SettlementTooltip';
import { Truck, MapPin, Shield, Castle, User } from 'lucide-react';

interface Props {
    state: WorldState | null;
    selectedHexId?: string | null;
    onSelectHex?: (hexId: string | null) => void;
}

const AgentParams: React.FC<{ agent: AgentEntity, size: number }> = ({ agent, size }) => {
    const { x, y } = HexUtils.hexToPixel(agent.position, size);

    // We should replicate that offset or move the offset to a parent container.
    // For now, let's replicate.

    const Icon = agent.type === 'Caravan' ? Truck
        : agent.type === 'Scout' ? MapPin
            : agent.type === 'Villager' ? User
                : Shield;

    return (
        <g transform={`translate(${x + 400}, ${y + 300})`} className="transition-all duration-500 ease-linear">
            <circle r={10} fill={agent.ownerId === 'player_1' ? '#3b82f6' : '#ef4444'} stroke="#fff" strokeWidth={2} />
            {/* Lucide icons are React components, but we are inside SVG. We need to wrap them or use foreignObject 
                OR just use simple SVG shapes for M2 to avoid scaling issues with HTML inside SVG.
                Let's use foreignObject for the icon.
            */}
            <foreignObject x={-8} y={-8} width={16} height={16}>
                <div className={`text-white flex items-center justify-center w-full h-full ${agent.type === 'Villager' ? 'text-emerald-200' : ''}`}>
                    <Icon size={12} />
                </div>
            </foreignObject>
        </g>
    );
};

const SettlementRenderer: React.FC<{ settlement: Settlement, size: number, map: Record<string, any> }> = ({ settlement, size, map }) => {
    const hex = map[settlement.hexId];
    if (!hex) return null;

    const { x, y } = HexUtils.hexToPixel(hex.coordinate, size);

    return (
        <g transform={`translate(${x + 400}, ${y + 300})`}>
            {/* City Base */}
            <circle r={settlement.tier === 2 ? 18 : 14} fill="#1e293b" stroke={settlement.tier === 2 ? '#22d3ee' : '#fbbf24'} strokeWidth={3} />

            {/* Icon */}
            <foreignObject x={-10} y={-10} width={20} height={20}>
                <div className={`${settlement.tier === 2 ? 'text-cyan-400' : 'text-yellow-400'} flex items-center justify-center w-full h-full`}>
                    <Castle size={settlement.tier === 2 ? 20 : 16} fill="currentColor" />
                </div>
            </foreignObject>

            {/* Name Label */}
            <text x="0" y="24" textAnchor="middle" fontSize="10" fill="#fff" stroke="#000" strokeWidth="0.5" className="font-bold pointer-events-none select-none">
                {settlement.name}
            </text>
            <text x="0" y="34" textAnchor="middle" fontSize="8" fill="#cbd5e1" stroke="#000" strokeWidth="0.5" className="pointer-events-none select-none">
                Pop: {Math.floor(settlement.population)}
            </text>
        </g>
    );
};

export const MapGrid: React.FC<Props> = ({ state, selectedHexId, onSelectHex }) => {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    const [hoveredSettlement, setHoveredSettlement] = useState<{ settlement: Settlement, position: { x: number, y: number } } | null>(null);

    // Calculate Highlighted Hexes (Controlled Territory)
    const highlightedHexIds = React.useMemo(() => {
        if (!state || !selectedHexId) return new Set<string>();

        // Find settlement at selected hex
        const settlement = Object.values(state.settlements).find(s => s.hexId === selectedHexId);
        if (settlement && settlement.controlledHexIds) {
            return new Set(settlement.controlledHexIds);
        }
        return new Set<string>();
    }, [state, selectedHexId]);

    // Calculate Owner Colors Map
    const hexOwnership = React.useMemo(() => {
        if (!state) return {};
        const ownership: Record<string, string> = {};

        Object.values(state.settlements).forEach(s => {
            const faction = state.factions[s.ownerId];
            if (faction && s.controlledHexIds) {
                const color = faction.color;
                s.controlledHexIds.forEach(id => {
                    ownership[id] = color;
                });
            }
        });
        return ownership;
    }, [state]);

    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scaleFactor = 1.1;
            const newZoom = e.deltaY < 0 ? zoom * scaleFactor : zoom / scaleFactor;
            const clampedZoom = Math.min(Math.max(newZoom, 0.1), 5);

            // Zoom towards mouse position
            const rect = container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // Current world coordinates under mouse
            const wx = (mx - pan.x) / zoom;
            const wy = (my - pan.y) / zoom;

            // New pan
            const newPanX = mx - wx * clampedZoom;
            const newPanY = my - wy * clampedZoom;

            setZoom(clampedZoom);
            setPan({ x: newPanX, y: newPanY });
        };

        // Add non-passive event listener
        container.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, [zoom, pan]);

    if (!state) return <div>Loading Map...</div>;



    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleSettlementHover = (settlement: Settlement, e: React.MouseEvent) => {
        setHoveredSettlement({
            settlement,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    const handleSettlementLeave = () => {
        setHoveredSettlement(null);
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 bg-slate-900 overflow-hidden relative border-r border-slate-700 cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <svg width="100%" height="100%" className="bg-slate-800">
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    <g>
                        {Object.values(state.map).map((cell) => {
                            let hasBuilding = false;
                            let isBroken = false;

                            // Find if this hex has a building from any settlement
                            for (const settlement of Object.values(state.settlements)) {
                                if (settlement.buildings) {
                                    const building = settlement.buildings.find(b => b.hexId === cell.id);
                                    if (building) {
                                        hasBuilding = true;
                                        if (building.integrity <= 0) isBroken = true;
                                        break; // Found a building, no need to check other settlements
                                    }
                                }
                            }

                            return (
                                <HexCell
                                    key={cell.id}
                                    cell={cell}
                                    size={25}
                                    isSelected={selectedHexId === cell.id}
                                    isHighlighted={highlightedHexIds.has(cell.id)}
                                    ownerColor={hexOwnership[cell.id]}
                                    hasBuilding={hasBuilding}
                                    isBroken={isBroken}
                                    onClick={() => !isDragging.current && onSelectHex?.(cell.id)}
                                />
                            );
                        })}

                        {/* Render Settlements */}
                        {Object.values(state.settlements).map(settlement => (
                            <g
                                key={settlement.id}
                                onClick={() => !isDragging.current && onSelectHex?.(settlement.hexId)}
                                onMouseEnter={(e) => handleSettlementHover(settlement, e)}
                                onMouseLeave={handleSettlementLeave}
                                className="cursor-pointer"
                            >
                                <SettlementRenderer settlement={settlement} size={25} map={state.map} />
                            </g>
                        ))}

                        {/* Render Agents (on top of cities) */}
                        {Object.values(state.agents).map(agent => (
                            <AgentParams key={agent.id} agent={agent} size={25} />
                        ))}
                    </g>
                </g>
            </svg>

            {/* Tooltip Layer */}
            {hoveredSettlement && (
                <SettlementTooltip settlement={hoveredSettlement.settlement} position={hoveredSettlement.position} />
            )}

            {/* Zoom Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-slate-800 p-2 rounded border border-slate-700">
                <button className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-xl" onClick={() => setZoom(z => Math.min(z * 1.2, 5))}>+</button>
                <button className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-xl" onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))}>-</button>
            </div>
        </div>
    );
};
