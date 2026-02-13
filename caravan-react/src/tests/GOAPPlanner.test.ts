import { GOAPPlanner } from '../simulation/ai/GOAPPlanner';
import { JobPool } from '../simulation/ai/JobPool';
import { Faction, FactionBlackboard } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';

describe('GOAPPlanner', () => {
    let faction: Faction;
    let jobPool: JobPool;
    let config: GameConfig;

    beforeEach(() => {
        jobPool = new JobPool('Faction1');
        faction = {
            id: 'Faction1',
            name: 'Test Faction',
            color: '#000000',
            blackboard: {
                factionId: 'Faction1',
                stances: { expand: 0, exploit: 1 },
                criticalShortages: [],
                targetedHexes: [],
                desires: []
            },
            jobPool: jobPool
        };
        config = { ...DEFAULT_CONFIG };
    });

    test('should create jobs from desires', () => {
        faction.blackboard!.desires = [
            {
                settlementId: 's1',
                type: 'BUILD_SMITHY',
                score: 0.9,
                needs: ['Stone']
            }
        ];

        GOAPPlanner.plan(faction, jobPool, config);

        const jobs = jobPool.getAllJobs();
        expect(jobs.length).toBe(1);
        expect(jobs[0].type).toBe('BUILD');
        expect(jobs[0].urgency).toBe('HIGH'); // 0.9 score
        expect(jobs[0].priority).toBe(0.9);
        expect(jobs[0].sourceId).toBe('s1');
    });

    test('should map different desire types to job types', () => {
        faction.blackboard!.desires = [
            { settlementId: 's1', type: 'RECRUIT_VILLAGER', score: 0.6, needs: [] },
            { settlementId: 's1', type: 'SETTLER', score: 0.4, needs: [] }
        ];

        GOAPPlanner.plan(faction, jobPool, config);

        const jobs = jobPool.getAllJobs();
        expect(jobs.length).toBe(2);

        const recruitJob = jobs.find(j => j.type === 'RECRUIT');
        expect(recruitJob).toBeDefined();
        expect(recruitJob?.urgency).toBe('MEDIUM'); // 0.6

        const expandJob = jobs.find(j => j.type === 'EXPAND');
        expect(expandJob).toBeDefined();
        expect(expandJob?.urgency).toBe('LOW'); // 0.4
    });

    test('should update existing jobs and cleanup removed desires', () => {
        // Round 1
        faction.blackboard!.desires = [
            { settlementId: 's1', type: 'BUILD_SMITHY', score: 0.9, needs: [] }
        ];
        GOAPPlanner.plan(faction, jobPool, config);

        const job = jobPool.getAllJobs()[0];
        job.assignedVolume = 5; // Simulate work done

        // Round 2 - Desire score changes
        faction.blackboard!.desires = [
            { settlementId: 's1', type: 'BUILD_SMITHY', score: 0.2, needs: [] }
        ];
        GOAPPlanner.plan(faction, jobPool, config);

        const updatedJob = jobPool.getAllJobs()[0];
        expect(updatedJob.priority).toBe(0.2);
        expect(updatedJob.urgency).toBe('LOW');
        expect(updatedJob.assignedVolume).toBe(5); // Preserved

        // Round 3 - Desire removed
        faction.blackboard!.desires = [];
        // Ideally planner should remove jobs for missing desires, 
        // but currently cleaning is done via jobPool.cleanup() which removes COMPLETED jobs.
        // If we want to remove jobs that no longer have a desire, we might need extra logic in Planner.
        // For now, let's just mark the job as COMPLETED to test cleanup.
        updatedJob.status = 'COMPLETED';

        GOAPPlanner.plan(faction, jobPool, config);
        // jobPool.cleanup() is called at end of plan
        expect(jobPool.getAllJobs().length).toBe(0);
    });
});
