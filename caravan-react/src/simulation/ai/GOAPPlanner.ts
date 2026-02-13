import { Faction } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { JobTicket, JobType, JobUrgency } from './AITypes';
import { JobPool } from './JobPool';


export class GOAPPlanner {
    static plan(faction: Faction, jobPool: JobPool, _config: GameConfig) {
        if (!faction.blackboard || !faction.blackboard.desires) return;

        const desires = faction.blackboard.desires;

        // 1. Audit & Decompose
        desires.forEach(desire => {
            // Map Desire Type to Job Type
            let jobType: JobType | undefined;
            switch (desire.type) {
                case 'BUILD_SMITHY': // Example mapping
                    jobType = 'BUILD';
                    break;
                case 'RECRUIT_VILLAGER':
                    jobType = 'RECRUIT';
                    break;
                case 'SETTLER':
                    jobType = 'EXPAND';
                    break;
                // Add more mappings as needed
            }

            // Handle Resource Collection Jobs (implicit in some desires)
            // For now, we'll extract resources from the desire if applicable
            // This is a simplified version of the "Decompose" step
            if (desire.type === 'UPGRADE') {
                // Logic to create COLLECT jobs for upgrade costs would go here
                // For now, we'll focus on the primary desire
            }

            if (jobType) {
                const jobId = `${faction.id}-${desire.settlementId}-${desire.type}`;
                const urgency = this.calculateUrgency(desire.score);

                const ticket: JobTicket = {
                    jobId: jobId,
                    factionId: faction.id,
                    sourceId: desire.settlementId,
                    type: jobType,
                    urgency: urgency,
                    priority: desire.score, // Use desire score directly for now
                    targetVolume: 1, // Default to 1 unit/action
                    assignedVolume: 0, // Reset assignment for fresh planning? Or keep persistent?
                    // Ideally we fetch existing job to preserve assignment, but for now we create fresh object to update
                    status: 'OPEN'
                };

                // Preserve existing assignment if job exists
                const existing = jobPool.getJob(jobId);
                if (existing) {
                    ticket.assignedVolume = existing.assignedVolume;
                    ticket.status = existing.status;
                }

                jobPool.addJob(ticket);
            }
        });

        // Cleanup old jobs?
        jobPool.cleanup();
    }

    private static calculateUrgency(score: number): JobUrgency {
        if (score > 0.8) return 'HIGH';
        if (score > 0.5) return 'MEDIUM';
        return 'LOW';
    }
}
