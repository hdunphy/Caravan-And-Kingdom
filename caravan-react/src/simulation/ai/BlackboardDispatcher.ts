import { WorldState, Faction, AgentEntity } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { JobTicket } from './AITypes';
import { HexUtils } from '../../utils/HexUtils';
import { JobPool } from './JobPool';
import { Logger } from '../../utils/Logger';

export class BlackboardDispatcher {

    /**
     * Polling method for Agents to find the best job.
     * Returns top N jobs sorted by bid score.
     */
    static getTopAvailableJobs(agent: AgentEntity, faction: Faction, state: WorldState, config: GameConfig, limit: number = 5): JobTicket[] {
        if (!faction.jobPool) return [];
        const pool = faction.jobPool as JobPool; // Cast to JobPool
        const jobs = pool.getAllJobs();

        // Filter OPEN jobs
        const openJobs = jobs.filter(j => j.status === 'OPEN');

        // Score jobs
        const scoredJobs = openJobs.map(job => {
            return {
                job,
                score: this.calculateBid(agent, job, state, config)
            };
        });

        // Sort by Score Descending
        scoredJobs.sort((a, b) => b.score - a.score);

        // Return top N
        return scoredJobs.slice(0, limit).map(item => item.job);
    }

    /**
     * Calculates a bid score for an agent on a specific job.
     * Score = (Base_Priority * Saturation_Factor) * Distance_Factor * Fulfillment_Factor
     */
    static calculateBid(agent: AgentEntity, job: JobTicket, state: WorldState, config: GameConfig): number {
        // 1. Saturation Factor
        // If assigned > target, factor is 0 or negative (should be filtered out by 'OPEN' check mostly)
        const saturation = Math.min(1.0, job.assignedVolume / Math.max(1, job.targetVolume));
        const saturationFactor = 1.0 - saturation;
        if (saturationFactor <= 0) return 0;

        // 2. Distance Factor
        // Heuristic: Distance from Agent to Job Target (or Source if no target hex)
        // If job has targetHexId (e.g. BUILD at X, GATHER at X), uses that.
        // If job just has sourceId (e.g. general request), uses settlement location.
        let targetHexId = job.targetHexId;
        if (!targetHexId && job.sourceId) {
            const settlement = state.settlements[job.sourceId];
            if (settlement) targetHexId = settlement.hexId;
        }

        let dist = 1;
        if (targetHexId) {
            const targetHex = state.map[targetHexId];
            if (targetHex) {
                dist = HexUtils.distance(agent.position, targetHex.coordinate);
            }
        }

        // Penalize long distance
        // e.g. dist 0 -> 1.0, dist 10 -> 0.1
        const distancePenalty = config.costs.movement || 1.0;
        const distanceFactor = 1.0 / Math.max(1, dist * distancePenalty);

        // 3. Fulfillment Factor (Capacity vs Remaining generic volume)
        // A caravan (50 cap) should prefer large jobs. A villager (20 cap) handles small ones fine.
        // Remaining = Target - Assigned
        const remaining = Math.max(1, job.targetVolume - job.assignedVolume);

        // Agent Capacity (Hardcoded fallback for now, ideally strictly typed or from config)
        let capacity = 20;
        if (agent.type === 'Caravan') capacity = config.costs.trade?.capacity || 50;
        if (agent.type === 'Villager') capacity = config.costs.villagers?.capacity || 20;

        const fulfillmentFactor = Math.min(1.0, remaining / capacity);

        // Base Priority from Job
        const basePriority = job.priority;

        return basePriority * saturationFactor * distanceFactor * fulfillmentFactor;
    }

    /**
     * Agent attempts to claim a job.
     * Updates job.assignedVolume and returns true if successful.
     */
    static claimJob(faction: Faction, agent: AgentEntity, job: JobTicket, amount: number): boolean {
        if (!faction.jobPool) return false;
        const pool = faction.jobPool as JobPool;

        // Re-check status
        const liveJob = pool.getJob(job.jobId);
        if (!liveJob || liveJob.status !== 'OPEN') return false;

        // Assign
        const success = pool.assign(liveJob.jobId, amount);
        if (success) {
            Logger.getInstance().log(`[Dispatcher] Agent ${agent.id} claimed ${liveJob.type} (Job: ${liveJob.jobId})`);
            return true;
        }

        return false;
    }

    /**
     * Called when an agent completes a delivery/action.
     */
    static reportProgress(faction: Faction, jobId: string, amountDone: number) {
        if (!faction.jobPool) return;
        const pool = faction.jobPool as JobPool;
        const job = pool.getJob(jobId);
        if (!job) return;

        // Reduce Assigned Volume (Worker is done with this "trip")
        job.assignedVolume = Math.max(0, job.assignedVolume - amountDone);

        if (job.type === 'BUILD' || job.type === 'COLLECT') {
            job.targetVolume = Math.max(0, job.targetVolume - amountDone);
            if (job.targetVolume <= 0) {
                job.status = 'COMPLETED';
            } else {
                if (job.assignedVolume < job.targetVolume) {
                    job.status = 'OPEN';
                }
            }
        }
    }

    /**
     * Agent aborted or died. Release their assignment.
     */
    static releaseAssignment(faction: Faction, jobId: string, amount: number) {
        if (!faction.jobPool) return;
        const pool = faction.jobPool as JobPool;
        const job = pool.getJob(jobId);
        if (!job) return;

        job.assignedVolume = Math.max(0, job.assignedVolume - amount);
        if (job.assignedVolume < job.targetVolume && job.status === 'SATURATED') {
            job.status = 'OPEN';
        }
    }
}
