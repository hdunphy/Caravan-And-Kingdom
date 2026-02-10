import React from 'react';
import { Settlement } from '../types/WorldTypes';

interface Props {
    settlement: Settlement;
    position: { x: number, y: number };
}

export const SettlementTooltip: React.FC<Props> = ({ settlement, position }) => {
    return (
        <div
            className="absolute z-50 bg-slate-900 border border-slate-600 rounded p-2 text-xs shadow-xl pointer-events-none"
            style={{
                left: position.x + 10,
                top: position.y + 10,
                minWidth: '150px'
            }}
        >
            <div className="font-bold text-white mb-1">{settlement.name}</div>
            <div className="flex justify-between text-slate-300">
                <span>Pop:</span>
                <span>{Math.floor(settlement.population)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
                <span>Tier:</span>
                <span className={settlement.tier > 0 ? 'text-cyan-400' : 'text-slate-400'}>{settlement.tier}</span>
            </div>
            <div className="flex justify-between text-slate-300">
                <span>Villagers:</span>
                <span className="text-emerald-400">
                    {settlement.availableVillagers} <span className="text-slate-500">Idle</span>
                </span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-700 grid grid-cols-2 gap-x-2">
                <span className="text-amber-200">F: {Math.floor(settlement.stockpile.Food)}</span>
                <span className="text-orange-200">T: {Math.floor(settlement.stockpile.Timber)}</span>
                <span className="text-stone-300">S: {Math.floor(settlement.stockpile.Stone)}</span>
                <span className="text-rose-300">O: {Math.floor(settlement.stockpile.Ore)}</span>
            </div>
        </div>
    );
};
