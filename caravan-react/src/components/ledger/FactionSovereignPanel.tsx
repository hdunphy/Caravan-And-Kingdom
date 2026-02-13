import React, { useState, useEffect } from 'react';
import { FactionBlackboard } from '../../types/WorldTypes';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface Props {
    blackboard: FactionBlackboard | null;
}

export const FactionSovereignPanel: React.FC<Props> = ({ blackboard }) => {
    const [history, setHistory] = useState<number[]>([]);

    // Track history for ghost needle (Moving average over last 10 samples approx 1000 ticks)
    useEffect(() => {
        if (blackboard) {
            setHistory(prev => {
                const updated = [...prev, blackboard.stances.expand];
                if (updated.length > 10) return updated.slice(1);
                return updated;
            });
        }
    }, [blackboard]);

    if (!blackboard) return null;

    const expand = blackboard.stances.expand;
    const exploit = blackboard.stances.exploit;
    const movingAverage = history.length > 0
        ? history.reduce((a, b) => a + b, 0) / history.length
        : expand;

    return (
        <div className="space-y-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={16} /> Sovereign Gauge
                </h3>
                <div className="text-[10px] text-slate-500 font-mono">
                    Updated every 100 ticks
                </div>
            </div>

            {/* Stance Gauge */}
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-blue-400">Expand</span>
                    <span className="text-orange-400">Exploit</span>
                </div>
                <div className="relative h-6 bg-slate-900 rounded-full border border-slate-700 overflow-hidden shadow-inner">
                    {/* Expand Bar */}
                    <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-in-out"
                        style={{ width: `${expand * 100}%` }}
                    />

                    {/* Center Divider */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />

                    {/* Ghost Needle (Moving Average) */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 transition-all duration-1000"
                        style={{ left: `${movingAverage * 100}%` }}
                        title="1,000 Tick Moving Average"
                    />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono italic">
                    <span>{Math.round(expand * 100)}%</span>
                    <span>{Math.round(exploit * 100)}%</span>
                </div>
            </div>

            {/* Strategic Alerts */}
            {blackboard.criticalShortages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                    <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1">
                        <AlertTriangle size={12} className="animate-pulse" /> Critical Shortages
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {blackboard.criticalShortages.map(res => (
                            <div key={res} className="px-2 py-1 bg-red-900/30 border border-red-500/50 rounded flex items-center gap-1 animate-pulse">
                                <span className="text-[10px] font-bold text-red-200">{res}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
