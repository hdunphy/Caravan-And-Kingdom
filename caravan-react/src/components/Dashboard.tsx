import React from 'react';
import { WorldState } from '../types/WorldTypes';
import { Box, User, Shield, Castle, Hammer, AlertTriangle, Trophy } from 'lucide-react';
import { AIGovernorPanel } from './AIGovernorPanel';

interface Props {
    state: WorldState | null;
    selectedHexId?: string | null;
}

export const Dashboard: React.FC<Props> = ({ state, selectedHexId }) => {
    if (!state) return <div className="w-80 bg-slate-900 border-r border-slate-700 p-4">Loading...</div>;

    const faction = state.factions['player_1'];

    // Find Selected Settlement (Center OR Controlled Territory)
    const selectedSettlement = selectedHexId ? Object.values(state.settlements).find(s => s.hexId === selectedHexId || s.controlledHexIds.includes(selectedHexId)) : null;

    // Calculate Total Faction Pop
    const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === 'player_1');
    const totalPop = factionSettlements.reduce((sum, s) => sum + s.population, 0);

    // Calculate Leaderboard Data
    const leaderboard = state ? Object.values(state.factions).map(f => {
        const settlements = Object.values(state.settlements).filter(s => s.ownerId === f.id);
        const pop = settlements.reduce((sum, s) => sum + s.population, 0);
        return { ...f, pop, settlementCount: settlements.length };
    }).sort((a, b) => b.pop - a.pop) : [];

    // Find Building on Selected Hex
    const selectedBuilding = selectedSettlement && selectedHexId && selectedSettlement.buildings
        ? selectedSettlement.buildings.find(b => b.hexId === selectedHexId)
        : null;

    return (
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full font-sans text-slate-100">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-950">
                <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                    <Shield size={20} />
                    {faction?.name || 'Kingdom'}
                </h2>
                <div className="text-xs text-slate-400 mt-1 flex justify-between">
                    <span>Tick: {state.tick}</span>
                    <div className="flex gap-3">
                        <span className="text-blue-400 flex items-center gap-1"><User size={10} /> {Math.floor(totalPop)}</span>
                        <span className="text-yellow-500">Gold: {Math.floor(faction?.gold || 0)}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {selectedSettlement ? (
                    // Settlement View
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-full ${selectedSettlement.tier === 2 ? 'bg-cyan-900 text-cyan-400' : 'bg-amber-900 text-amber-400'}`}>
                                <Castle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">{selectedSettlement.name}</h3>
                                <div className="text-xs text-slate-400">
                                    {selectedSettlement.tier === 2 ? 'City' : selectedSettlement.tier === 1 ? 'Town' : 'Village'}
                                </div>
                            </div>
                        </div>

                        {selectedBuilding && (
                            <div className="bg-slate-800 p-3 rounded border border-slate-600 shadow-lg">
                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                                    <Hammer size={12} /> {selectedBuilding.type}
                                </h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-300">
                                        <span>Integrity</span>
                                        <span>{Math.floor(selectedBuilding.integrity)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-700">
                                        <div
                                            className={`h-full ${selectedBuilding.integrity > 50 ? 'bg-emerald-500' : selectedBuilding.integrity > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${selectedBuilding.integrity}%` }}
                                        />
                                    </div>
                                    {selectedBuilding.integrity <= 0 && (
                                        <div className="text-xs text-red-500 font-bold flex items-center gap-1">
                                            <AlertTriangle size={10} /> Broken (Effects Disabled)
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Population */}
                        <div className="bg-slate-800 p-3 rounded border border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <User size={12} /> Population
                                </h4>
                                <span className={`text-xs ${selectedSettlement.lastGrowth && selectedSettlement.lastGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {selectedSettlement.lastGrowth ? (selectedSettlement.lastGrowth > 0 ? '+' : '') + selectedSettlement.lastGrowth.toFixed(2) : '0.00'}/t
                                </span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-2xl font-bold">{Math.floor(selectedSettlement.population)}</span>
                                <span className="text-xs text-slate-400 mb-1">
                                    Workers: {Math.floor(selectedSettlement.workingPop)}/{selectedSettlement.jobCap}
                                </span>
                            </div>
                        </div>

                        {/* Stockpile */}
                        <div className="bg-slate-800 p-3 rounded border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-3">
                                <Box size={12} /> Local Resources
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <StockItem label="Food" value={selectedSettlement.stockpile.Food} delta={selectedSettlement.resourceChange?.Food} color="text-green-400" />
                                <StockItem label="Timber" value={selectedSettlement.stockpile.Timber} delta={selectedSettlement.resourceChange?.Timber} color="text-amber-600" />
                                <StockItem label="Stone" value={selectedSettlement.stockpile.Stone} delta={selectedSettlement.resourceChange?.Stone} color="text-stone-400" />
                                <StockItem label="Ore" value={selectedSettlement.stockpile.Ore} delta={selectedSettlement.resourceChange?.Ore} color="text-purple-400" />
                                <StockItem label="Tools" value={selectedSettlement.stockpile.Tools} delta={selectedSettlement.resourceChange?.Tools} color="text-blue-400" />
                            </div>
                        </div>

                        {/* AI Governor Panel */}
                        <AIGovernorPanel settlement={selectedSettlement} />
                    </div>
                ) : (
                    // Faction Leaderboard...
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4 text-slate-400">
                            <Trophy size={16} />
                            <h3 className="text-sm font-bold uppercase tracking-wider">Faction Leaderboard</h3>
                        </div>

                        <div className="space-y-2">
                            {leaderboard.map((f, i) => (
                                <div key={f.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-slate-300 w-6">{i + 1}.</div>
                                        <div>
                                            <div className="font-bold text-white" style={{ color: f.color }}>{f.name}</div>
                                            <div className="text-xs text-slate-500">{f.settlementCount} Settlements</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-mono font-bold text-slate-200">{Math.floor(f.pop)}</div>
                                        <div className="text-xs text-yellow-600">{Math.floor(f.gold || 0)}g</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 text-xs text-center text-slate-600">
                            Select a settlement on the map to view details.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StockItem = ({ label, value, delta, color }: { label: string, value: number, delta?: number, color: string }) => (
    <div className="flex flex-col bg-slate-900/50 p-2 rounded relative">
        <span className="text-[10px] text-slate-500 uppercase">{label}</span>
        <span className={`font-mono font-bold ${color}`}>{Math.floor(value)}</span>
        {delta !== undefined && Math.abs(delta) > 0.01 && (
            <span className={`absolute top-2 right-2 text-[10px] font-mono ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}/t
            </span>
        )}
    </div>
);


