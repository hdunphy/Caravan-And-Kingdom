import React from 'react';
import { WorldState } from '../types/WorldTypes';
import { Trophy, Users, Coins, MapPin } from 'lucide-react';

interface Props {
    state: WorldState | null;
    onClose: () => void;
}

export const Leaderboard: React.FC<Props> = ({ state, onClose }) => {
    if (!state) return null;

    // Calculate Faction Stats
    const factionStats = Object.values(state.factions).map(faction => {
        const settlements = Object.values(state.settlements).filter(s => s.ownerId === faction.id);
        const totalPop = settlements.reduce((sum, s) => sum + s.population, 0);
        const settlementCount = settlements.length;

        return {
            ...faction,
            totalPop,
            settlementCount
        };
    }).sort((a, b) => b.totalPop - a.totalPop);

    return (
        <div className="absolute top-16 right-4 z-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> Faction Leaderboard
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">Close</button>
            </div>

            <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                {factionStats.map((faction, index) => (
                    <div key={faction.id} className="bg-slate-950/50 rounded border border-slate-800 p-2 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-800 text-slate-500'}`}>
                                    {index + 1}
                                </span>
                                <span className="text-sm font-bold" style={{ color: faction.color }}>{faction.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-yellow-400 text-xs font-mono bg-yellow-900/20 px-1.5 py-0.5 rounded">
                                <Coins size={10} />
                                {Math.floor(faction.gold || 0)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pl-7">
                            <div className="flex items-center gap-1" title="Total Population">
                                <Users size={12} /> {Math.floor(faction.totalPop)}
                            </div>
                            <div className="flex items-center gap-1" title="Settlements">
                                <MapPin size={12} /> {faction.settlementCount}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
