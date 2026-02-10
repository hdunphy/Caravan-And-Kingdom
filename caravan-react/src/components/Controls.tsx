import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useGameConfig } from '../contexts/GameConfigContext';

interface Props {
    isRunning: boolean;
    onToggle: () => void;
    onReset: () => void;
}

export const Controls: React.FC<Props> = ({ isRunning, onToggle, onReset }) => {
    const { config, updateConfig } = useGameConfig();



    return (
        <div className="absolute top-4 left-4 flex gap-2 z-10 items-center">
            <button
                onClick={onToggle}
                className={`p-3 rounded-full text-white shadow-lg transition-colors border border-slate-600 ${isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
            >
                {isRunning ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            <button
                onClick={onReset}
                className="p-3 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-full shadow-lg border border-slate-600"
            >
                <RotateCcw size={20} />
            </button>



            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-full border border-slate-600 px-3">
                <span className="text-xs text-slate-400 font-mono">SPEED</span>
                <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    defaultValue={1.0}
                    className="w-20 cursor-pointer"
                    onChange={(e) => {
                        const multiplier = parseFloat(e.target.value);
                        // Base is 100ms. 
                        // 1x = 100ms
                        // 2x = 50ms
                        // 0.5x = 200ms
                        const newTickRate = 100 / multiplier;

                        updateConfig({
                            ...config,
                            simulation: {
                                ...config.simulation,
                                tickRate: newTickRate
                            }
                        });
                    }}
                />
                <span className="text-xs text-slate-400 w-8 text-right font-mono">
                    {(100 / config.simulation.tickRate).toFixed(1)}x
                </span>
            </div>
        </div>
    );
};
