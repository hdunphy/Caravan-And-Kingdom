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
        // Weights from Config
        const wDist = config.ai.bidding?.distanceWeight ?? 1.0;
        const wSat = config.ai.bidding?.saturationWeight ?? 1.0;
        const wFull = config.ai.bidding?.fulfillmentWeight ?? 1.0;

        // 1. Saturation Factor (Lower is better, so 1.0 - saturation)
        // If assigned > target, factor is 0
        const saturation = Math.min(1.0, job.assignedVolume / Math.max(1, job.targetVolume));
        const saturationFactor = Math.pow(1.0 - saturation, wSat);
        if (saturationFactor <= 0) return 0;

        // 2. Distance Factor (Inverse distance)
        // Heuristic: Distance from Agent to Job Target
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
        const rawDistFactor = 1.0 / Math.max(1, dist * distancePenalty);
        const distanceFactor = Math.pow(rawDistFactor, wDist);

        // 3. Fulfillment Factor (Capacity vs Remaining generic volume)
        // Remaining = Target - Assigned
        const remaining = Math.max(1, job.targetVolume - job.assignedVolume);

        // Agent Capacity
        let capacity = 20;
        if (agent.type === 'Caravan') capacity = config.costs.trade?.capacity || 50;
        if (agent.type === 'Villager') capacity = config.costs.villagers?.capacity || 20;

        // We want agents to pick jobs they can FILL.
        // If remaining >>> capacity, ratio > 1.0 -> 1.0 (Good)
        // If remaining <<< capacity, ratio < 1.0 -> Penalize (Waste of trip partial fill?)
        // Actually, if we have 50 cap and job needs 5, it's inefficient?
        // Let's stick to "How much of my capacity is used?"
        // predictedLoad = min(remaining, capacity)
        // efficiency = predictedLoad / capacity.
        const predictedLoad = Math.min(remaining, capacity);
        const efficiency = predictedLoad / capacity;
        const fulfillmentFactor = Math.pow(efficiency, wFull);

        // Base Priority from Job
        const basePriority = job.priority;

        const finalScore = basePriority * saturationFactor * distanceFactor * fulfillmentFactor;
        // if (finalScore > 0) process.stderr.write(`[Dispatcher DEBUG] Agent ${agent.id} bid for ${job.jobId}: ${finalScore.toFixed(2)} (Prio: ${basePriority}, Sat: ${saturationFactor.toFixed(2)}, Dist: ${distanceFactor.toFixed(2)}, Full: ${fulfillmentFactor.toFixed(2)})\n`);
        return finalScore;

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
