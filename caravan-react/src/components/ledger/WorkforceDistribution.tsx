import React from 'react';
import { JobTicket } from '../../simulation/ai/AITypes';
import { Users, ClipboardList } from 'lucide-react';

interface Props {
    jobs: JobTicket[];
}

export const WorkforceDistribution: React.FC<Props> = ({ jobs }) => {
    // 🔴 HIGH: Survival/Food gathering.
    // 🟡 MEDIUM: Strategic projects (Expansion/Construction).
    // 🟢 LOW: General surplus/Gold hoarding.

    const distribution = jobs.reduce((acc, job) => {
        const u = job.urgency || 'LOW';
        acc[u] = (acc[u] || 0) + job.assignedVolume;
        acc.total = (acc.total || 0) + job.assignedVolume;
        return acc;
    }, { HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 });

    const getPercent = (val: number) => {
        if (distribution.total === 0) return 0;
        return (val / distribution.total) * 100;
    };

    // Sort jobs by priority for the table
    const sortedJobs = [...jobs].sort((a, b) => b.priority - a.priority).slice(0, 10);

    return (
        <div className="space-y-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
                <Users size={16} /> Workforce Distribution
            </h3>

            {/* Labor Donut/Stacked Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                    <span>Labor Allocation by Urgency</span>
                    <span>Total: {Math.floor(distribution.total)}</span>
                </div>
                <div className="flex h-4 w-full rounded-full overflow-hidden bg-slate-900 border border-slate-700 shadow-inner">
                    <div
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${getPercent(distribution.HIGH)}%` }}
                        title={`High Urgency: ${Math.round(getPercent(distribution.HIGH))}%`}
                    />
                    <div
                        className="h-full bg-yellow-500 transition-all duration-500"
                        style={{ width: `${getPercent(distribution.MEDIUM)}%` }}
                        title={`Medium Urgency: ${Math.round(getPercent(distribution.MEDIUM))}%`}
                    />
                    <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${getPercent(distribution.LOW)}%` }}
                        title={`Low Urgency: ${Math.round(getPercent(distribution.LOW))}%`}
                    />
                </div>
                <div className="flex gap-4 text-[9px] justify-center text-slate-500">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> HIGH (Survival)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> MEDIUM (Projects)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> LOW (Surplus)</div>
                </div>
            </div>

            {/* Summarized Bounty Board */}
            <div className="space-y-2 pt-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                    <ClipboardList size={12} /> Active Bounties (Top 10)
                </h4>
                <div className="overflow-hidden rounded border border-slate-700">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 text-[9px] text-slate-500 font-bold uppercase">
                                <th className="p-1 px-2">Job Type</th>
                                <th className="p-1">Target</th>
                                <th className="p-1 text-center">Prio</th>
                                <th className="p-1 text-right px-2">Volume</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px]">
                            {sortedJobs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-600 italic">No open jobs on the board.</td>
                                </tr>
                            ) : (
                                sortedJobs.map(job => (
                                    <tr key={job.jobId} className="border-t border-slate-800/50 hover:bg-slate-700/30 transition-colors">
                                        <td className="p-1 px-2 flex items-center gap-1">
                                            <div className={`w-1 h-3 rounded-full ${job.urgency === 'HIGH' ? 'bg-red-500' : job.urgency === 'MEDIUM' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                                            {job.type}
                                        </td>
                                        <td className="p-1 text-slate-400">{job.resource || 'ANY'}</td>
                                        <td className="p-1 text-center font-mono text-amber-500">{job.priority.toFixed(1)}</td>
                                        <td className="p-1 text-right px-2 font-mono">
                                            <span className="text-slate-200">{Math.floor(job.assignedVolume)}</span>
                                            <span className="text-slate-500">/{job.targetVolume}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
