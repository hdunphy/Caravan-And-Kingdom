import React from 'react';
import { DesireTicket } from '../../types/WorldTypes';
import { LayoutList, Package, Hammer, Users, RefreshCw, ArrowUpCircle } from 'lucide-react';

interface Props {
    desires: DesireTicket[];
}

export const SettlementProjectFeed: React.FC<Props> = ({ desires }) => {
    // Aggregation Logic: Group tickets by type
    const aggregated = desires.reduce((acc, ticket) => {
        if (!acc[ticket.type]) {
            acc[ticket.type] = {
                type: ticket.type,
                count: 0,
                totalScore: 0,
                needs: new Set<string>()
            };
        }
        acc[ticket.type].count++;
        acc[ticket.type].totalScore += ticket.score;
        ticket.needs.forEach(n => acc[ticket.type].needs.add(n));
        return acc;
    }, {} as Record<string, { type: string, count: number, totalScore: number, needs: Set<string> }>);

    const projects = Object.values(aggregated).sort((a, b) => b.totalScore - a.totalScore);

    const getHumanReadable = (type: string) => {
        switch (type) {
            case 'UPGRADE': return 'Metropolitan Modernization';
            case 'SETTLER': return 'Frontier Colonization';
            case 'RECRUIT_VILLAGER': return 'Labor Expansion';
            case 'BUILD_FISHERY': return 'Maritime Infrastructure';
            case 'BUILD_GRANARY': return 'Food Security Storage';
            case 'BUILD_SMITHY': return 'Smithy Construction';
            case 'TRADE_CARAVAN': return 'Mercantile Logistics';
            case 'REPLENISH': return 'Emergency Aid';
            default: return type.replace(/_/g, ' ');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'UPGRADE': return <ArrowUpCircle size={14} className="text-cyan-400" />;
            case 'SETTLER': return <LayoutList size={14} className="text-blue-400" />;
            case 'RECRUIT_VILLAGER': return <Users size={14} className="text-emerald-400" />;
            case 'REPLENISH': return <RefreshCw size={14} className="text-red-400" />;
            default: return <Hammer size={14} className="text-slate-400" />;
        }
    };

    return (
        <div className="space-y-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
                <Package size={16} /> Active Projects
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {projects.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-4 text-center">
                        No active strategic projects.
                    </div>
                ) : (
                    projects.map(project => (
                        <div key={project.type} className="group bg-slate-900/40 p-2 rounded border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    {getIcon(project.type)}
                                    <span className="text-[11px] font-bold text-slate-200">
                                        {getHumanReadable(project.type)}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500">
                                    x{project.count}
                                </span>
                            </div>

                            {/* Resource Progressive Bar (Multi-segment mock for materials) */}
                            <div className="flex gap-1 h-1.5 mt-2 bg-slate-950 rounded-full overflow-hidden">
                                {Array.from(project.needs).map((res) => (
                                    <div
                                        key={res}
                                        className={`flex-1 ${getResourceColor(res)}`}
                                        title={res}
                                    />
                                ))}
                            </div>

                            <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-slate-500 italic">
                                    {Array.from(project.needs).join(', ')}
                                </span>
                                <span className="text-[9px] font-bold text-amber-500/80">
                                    PRIORITY: {Math.min(10, Math.ceil(project.totalScore * 5)).toFixed(0)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const getResourceColor = (res: string) => {
    switch (res) {
        case 'Food': return 'bg-green-500';
        case 'Stone': return 'bg-stone-400';
        case 'Timber': return 'bg-amber-600';
        case 'Ore': return 'bg-purple-500';
        case 'Gold': return 'bg-yellow-500';
        case 'Tools': return 'bg-blue-400';
        default: return 'bg-slate-600';
    }
};
