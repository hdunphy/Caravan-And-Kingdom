import { useState, useEffect } from 'react';
import { WorldState, FactionBlackboard } from '../types/WorldTypes';
import { JobTicket } from '../simulation/ai/AITypes';
import { JobPool } from '../simulation/ai/JobPool';

/**
 * Hook to fetch and memoize blackboard data for a specific faction.
 * Data is sampled once every 100 ticks to prevent simulation lag.
 */
export function useBlackboard(state: WorldState | null, factionId: string) {
    const [sampledData, setSampledData] = useState<{
        blackboard: FactionBlackboard | null,
        jobs: JobTicket[]
    }>({
        blackboard: null,
        jobs: []
    });

    useEffect(() => {
        if (!state) return;

        // Sample every 100 ticks
        if (state.tick % 100 === 0 || !sampledData.blackboard) {
            const faction = state.factions[factionId];
            if (faction) {
                const blackboard = faction.blackboard ? {
                    ...faction.blackboard,
                    stances: { ...faction.blackboard.stances },
                    criticalShortages: [...faction.blackboard.criticalShortages],
                    targetedHexes: [...faction.blackboard.targetedHexes],
                    desires: faction.blackboard.desires ? [...faction.blackboard.desires] : []
                } : null;

                const jobs = faction.jobPool ? (faction.jobPool as JobPool).getAllJobs().map((j: JobTicket) => ({ ...j })) : [];

                setSampledData({
                    blackboard,
                    jobs
                });
            }
        }
    }, [state?.tick, factionId]);

    return sampledData;
}
