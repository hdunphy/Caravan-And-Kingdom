import { JobTicket, JobStatus } from './AITypes';
import { Logger } from '../../utils/Logger';

export class JobPool {
    private jobs: Map<string, JobTicket> = new Map();
    private factionId: string;

    constructor(factionId: string) {
        this.factionId = factionId;
    }

    /**
     * Adds or updates a job in the pool.
     * If job exists (same ID), updates fields but preserves assignment data if not resetting.
     */
    addJob(job: JobTicket) {
        if (this.jobs.has(job.jobId)) {
            const existing = this.jobs.get(job.jobId)!;
            // Update priority and urgency
            existing.priority = job.priority;
            existing.urgency = job.urgency;
            existing.targetVolume = job.targetVolume;

            // If we are updating, we check saturation
            this.checkSaturation(existing);
        } else {
            this.jobs.set(job.jobId, job);
            Logger.getInstance().log(`[JobPool] New Job: ${job.type} for ${job.sourceId} (Prio: ${job.priority.toFixed(1)})`);
        }
    }

    getJob(jobId: string): JobTicket | undefined {
        return this.jobs.get(jobId);
    }

    getAllJobs(): JobTicket[] {
        return Array.from(this.jobs.values());
    }

    /**
     * Assigns 'amount' volume to a job.
     */
    assign(jobId: string, amount: number): boolean {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'OPEN') return false;

        job.assignedVolume += amount;
        this.checkSaturation(job);
        return true;
    }

    /**
     * Scans for completed or stale jobs.
     */
    cleanup() {
        const toRemove: string[] = [];
        this.jobs.forEach((job, id) => {
            if (job.status === 'COMPLETED') {
                toRemove.push(id);
            }
            // Logic for stale jobs could go here
        });

        toRemove.forEach(id => this.jobs.delete(id));
    }

    private checkSaturation(job: JobTicket) {
        if (job.assignedVolume >= job.targetVolume) {
            job.status = 'SATURATED';
        } else {
            job.status = 'OPEN';
        }
    }
}
