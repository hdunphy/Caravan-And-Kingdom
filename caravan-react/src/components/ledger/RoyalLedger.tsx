import React from 'react';
import { WorldState } from '../../types/WorldTypes';
import { useBlackboard } from '../../hooks/useBlackboard';
import { FactionSovereignPanel } from './FactionSovereignPanel';
import { SettlementProjectFeed } from './SettlementProjectFeed';
import { WorkforceDistribution } from './WorkforceDistribution';
import { BarChart3 } from 'lucide-react';

interface Props {
    state: WorldState | null;
    factionId: string;
}

export const RoyalLedger: React.FC<Props> = ({ state, factionId }) => {
    const { blackboard, jobs } = useBlackboard(state, factionId);

    if (!state) return null;

    return (
        <div className="h-full flex flex-col">
            <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <BarChart3 size={16} className="text-amber-500" /> The Royal Ledger
                </h3>
            </div>

            <div className="p-3 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <FactionSovereignPanel blackboard={blackboard} />
                <SettlementProjectFeed desires={blackboard?.desires || []} />
                <WorkforceDistribution jobs={jobs} />
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="text-[10px] text-slate-600 text-center italic">
                    "A King only knows what he can measure."
                </div>
            </div>
        </div>
    );
};
