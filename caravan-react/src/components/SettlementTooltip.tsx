import React from 'react';
import { Settlement } from '../types/WorldTypes';

import { PopulationSparkline } from './PopulationSparkline';

interface SettlementTooltipProps {
    settlement: Settlement;
    position: { x: number, y: number };
}

export const SettlementTooltip: React.FC<SettlementTooltipProps> = ({ settlement, position }) => {
    return (
        <div
            className="absolute z-50 bg-slate-900/90 p-3 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm min-w-[200px] pointer-events-none"
            style={{
                left: position.x + 15,
                top: position.y + 15
            }}
        >
            <div className="font-bold text-lg text-slate-100 mb-1">{settlement.name}</div>
            <div className="text-xs text-slate-400 mb-2">Tier {settlement.tier} • {settlement.hexId}</div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                <div className="text-slate-400">Pop:</div>
                <div className="text-right text-slate-200">{Math.floor(settlement.population)}</div>

                <div className="text-slate-400">Labor:</div>
                <div className={`text-right ${settlement.workingPop >= settlement.jobCap ? 'text-yellow-400' : 'text-slate-200'}`}>
                    {Math.floor(settlement.workingPop)} / {settlement.jobCap}
                </div>

                <div className="text-slate-400">Villagers:</div>
                <div className="text-right text-slate-200">{settlement.availableVillagers}</div>

                <div className="text-slate-400">Integrity:</div>
                <div className="text-right text-slate-200">{Math.floor(settlement.integrity)}%</div>
            </div>

            <div className="mt-1 pt-1 border-t border-slate-700 grid grid-cols-2 gap-x-2 text-xs mb-3">
                <span className="text-amber-200">F: {Math.floor(settlement.stockpile.Food)}</span>
                <span className="text-orange-200">T: {Math.floor(settlement.stockpile.Timber)}</span>
                <span className="text-stone-300">S: {Math.floor(settlement.stockpile.Stone)}</span>
                <span className="text-rose-300">O: {Math.floor(settlement.stockpile.Ore)}</span>
            </div>

            {/* Population Sparkline */}
            {settlement.popHistory && settlement.popHistory.length > 5 && (
                <div className="mb-3 pt-2 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mb-1 flex justify-between">
                        <span>Min: {Math.floor(Math.min(...settlement.popHistory))}</span>
                        <span>Max: {Math.floor(Math.max(...settlement.popHistory))}</span>
                    </div>
                    <PopulationSparkline data={settlement.popHistory} width={180} height={40} />
                </div>
            )}

            {/* AI Decisions */}
            {settlement.aiState?.lastDecisions && (
                <div className="pt-2 border-t border-slate-700">
                    <div className="font-semibold text-slate-400 text-xs mb-1 uppercase tracking-wider">Top AI Priorities</div>
                    <div className="space-y-1">
                        {Object.entries(settlement.aiState.lastDecisions).map(([governor, decisions]) => (
                            decisions && decisions.length > 0 ? (
                                <div key={governor} className="flex justify-between text-xs items-center">
                                    <span className="text-slate-500 w-12 shrink-0">{governor}:</span>
                                    <span className="text-emerald-400 truncate max-w-[120px]" title={decisions.join('\n')}>
                                        {decisions[0]}
                                    </span>
                                </div>
                            ) : null
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
