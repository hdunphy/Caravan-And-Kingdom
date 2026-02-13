import { JobPool } from '../simulation/ai/JobPool';
import { JobTicket } from '../simulation/ai/AITypes';

describe('JobPool', () => {
    let jobPool: JobPool;
    const factionId = 'Faction1';

    beforeEach(() => {
        jobPool = new JobPool(factionId);
    });

    test('should add a job', () => {
        const job: JobTicket = {
            jobId: 'j1',
            factionId,
            sourceId: 's1',
            type: 'COLLECT',
            urgency: 'MEDIUM',
            priority: 0.5,
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN'
        };

        jobPool.addJob(job);
        expect(jobPool.getJob('j1')).toEqual(job);
    });

    test('should update an existing job without resetting status if not complete', () => {
        const job1: JobTicket = {
            jobId: 'j1',
            factionId,
            sourceId: 's1',
            type: 'COLLECT',
            urgency: 'MEDIUM',
            priority: 0.5,
            targetVolume: 100,
            assignedVolume: 50,
            status: 'OPEN'
        };
        jobPool.addJob(job1);

        const jobUpdate: JobTicket = { ...job1, priority: 0.8, urgency: 'HIGH' };
        jobPool.addJob(jobUpdate);

        const stored = jobPool.getJob('j1');
        expect(stored?.priority).toBe(0.8);
        expect(stored?.urgency).toBe('HIGH');
        expect(stored?.assignedVolume).toBe(50); // Should be preserved
    });

    test('should saturate a job', () => {
        const job: JobTicket = {
            jobId: 'j2',
            factionId,
            sourceId: 's1',
            type: 'BUILD',
            urgency: 'HIGH',
            priority: 1.0,
            targetVolume: 1,
            assignedVolume: 0,
            status: 'OPEN'
        };
        jobPool.addJob(job);

        const success = jobPool.assign('j2', 1);
        expect(success).toBe(true);
        expect(jobPool.getJob('j2')?.status).toBe('SATURATED');
    });

    test('should cleanup completed jobs', () => {
        const job: JobTicket = {
            jobId: 'j3',
            factionId,
            sourceId: 's1',
            type: 'RECRUIT',
            urgency: 'LOW',
            priority: 0.2,
            targetVolume: 1,
            assignedVolume: 1,
            status: 'COMPLETED'
        };
        jobPool.addJob(job);

        jobPool.cleanup();
        expect(jobPool.getJob('j3')).toBeUndefined();
    });
});
