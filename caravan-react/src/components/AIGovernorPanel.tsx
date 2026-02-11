import React from 'react';
import { Settlement } from '../types/WorldTypes';

interface AIGovernorPanelProps {
    settlement: Settlement;
}

export const AIGovernorPanel: React.FC<AIGovernorPanelProps> = ({ settlement }) => {
    if (!settlement.aiState || !settlement.aiState.lastDecisions) {
        return <div className="p-4 text-gray-400 italic">No AI data available</div>;
    }

    const decisions = settlement.aiState.lastDecisions;

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-white w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">
                AI Governor: {settlement.name}
            </h3>

            <div className="space-y-4">
                {/* Civil Governor */}
                <div className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-blue-300">Civil Governor</span>
                        <span className="text-xs text-gray-400">Construction & Expansion</span>
                    </div>
                    {renderDecisions(decisions['CIVIL'])}
                </div>

                {/* HR Governor */}
                <div className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-green-300">HR Governor</span>
                        <span className="text-xs text-gray-400">Workforce & Logistics</span>
                    </div>
                    {renderDecisions(decisions['HR'])}
                </div>

                {/* Trade Governor */}
                <div className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-yellow-300">Trade Governor</span>
                        <span className="text-xs text-gray-400">Commerce & Exchange</span>
                    </div>
                    {renderDecisions(decisions['TRADE'])}
                </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
                Mode: {settlement.aiState.surviveMode ? <span className="text-red-500">SURVIVAL</span> : <span className="text-green-500">NORMAL</span>}
                {settlement.aiState.savingFor && <span className="ml-2">| Saving: {settlement.aiState.savingFor}</span>}
            </div>
        </div>
    );
};

const renderDecisions = (lines: string[] | undefined) => {
    if (!lines || lines.length === 0) return <div className="text-gray-500 text-sm">Idle</div>;

    return (
        <ul className="space-y-1">
            {lines.map((line, idx) => {
                const [action, score] = line.split(':');
                return (
                    <li key={idx} className="flex justify-between text-sm">
                        <span className="truncate pr-2">{formatAction(action)}</span>
                        <span className="font-mono text-gray-300">{score}</span>
                    </li>
                );
            })}
        </ul>
    );
};

const formatAction = (raw: string) => {
    return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};
