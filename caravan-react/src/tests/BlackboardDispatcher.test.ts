import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { JobPool } from '../simulation/ai/JobPool';
import { Faction, WorldState, AgentEntity, JobTicket } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { HexUtils } from '../utils/HexUtils';

describe('BlackboardDispatcher', () => {
    let faction: Faction;
    let jobPool: JobPool;
    const config = { ...DEFAULT_CONFIG };
    const state = {
        map: {},
        settlements: {},
        agents: {},
        factions: {},
        tick: 0
    } as unknown as WorldState;

    beforeEach(() => {
        jobPool = new JobPool('F1');
        faction = {
            id: 'F1',
            name: 'Test Faction',
            color: '#000',
            jobPool: jobPool
        };
        state.factions['F1'] = faction;
    });

    test('should calculate bid scores correctly (Prioritize Distance & Saturation)', () => {
        const agent: AgentEntity = {
            id: 'a1',
            type: 'Villager',
            position: { q: 0, r: 0, s: 0 },
            ownerId: 'F1',
            integrity: 100,
            path: [], cargo: {}, activity: 'IDLE'
        } as any;

        const job: JobTicket = {
            jobId: 'j1',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0, // High Priority
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: '0,0' // Distance 0
        };

        // Mock map for distance
        state.map['0,0'] = { coordinate: { q: 0, r: 0, s: 0 } } as any;

        const scoreClose = BlackboardDispatcher.calculateBid(agent, job, state, config);

        // Move job far away
        const jobFar = { ...job, targetHexId: '10,10', jobId: 'j2' };
        state.map['10,10'] = { coordinate: { q: 10, r: 10, s: -20 } } as any;

        const scoreFar = BlackboardDispatcher.calculateBid(agent, jobFar, state, config);

        expect(scoreClose).toBeGreaterThan(scoreFar);
    });

    test('should sort jobs by score', () => {
        const agent: AgentEntity = {
            id: 'a1',
            type: 'Villager',
            position: { q: 0, r: 0, s: 0 },
            ownerId: 'F1',
            integrity: 100,
            path: [], cargo: {}, activity: 'IDLE'
        } as any;

        const jobHighPri: JobTicket = {
            jobId: 'j1',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0,
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: '0,0'
        };

        const jobLowPri: JobTicket = {
            jobId: 'j2',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 0.1,
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'LOW',
            targetHexId: '0,0'
        };

        jobPool.addJob(jobHighPri);
        jobPool.addJob(jobLowPri);

        // Mock Map
        state.map['0,0'] = { coordinate: { q: 0, r: 0, s: 0 } } as any;

        const jobs = BlackboardDispatcher.getTopAvailableJobs(agent, faction, state, config);
        expect(jobs[0].jobId).toBe('j1');
        expect(jobs[1].jobId).toBe('j2');
    });

    test('should prevent claiming saturated jobs', () => {
        const job: JobTicket = {
            jobId: 'j1',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0,
            targetVolume: 20,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH'
        };
        jobPool.addJob(job);

        const agent1: AgentEntity = { id: 'a1', type: 'Villager' } as any;
        const agent2: AgentEntity = { id: 'a2', type: 'Villager' } as any;

        // Agent 1 Claims (Capacity 20 fills it)
        const success1 = BlackboardDispatcher.claimJob(faction, agent1, job, 20);
        expect(success1).toBe(true);
        expect(jobPool.getJob('j1')?.status).toBe('SATURATED');

        // Agent 2 Tries
        const success2 = BlackboardDispatcher.claimJob(faction, agent2, job, 20);
        expect(success2).toBe(false); // Should fail as it's saturated
    });

    test('should update progress and complete job', () => {
        const job: JobTicket = {
            jobId: 'j1',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0,
            targetVolume: 50,
            assignedVolume: 20, // 1 agent working
            status: 'OPEN',
            urgency: 'HIGH'
        };
        jobPool.addJob(job);

        // Worker delivers 20
        BlackboardDispatcher.reportProgress(faction, 'j1', 20);

        const updated = jobPool.getJob('j1');
        expect(updated?.assignedVolume).toBe(0); // Worker freed
        expect(updated?.targetVolume).toBe(30); // 50 - 20 done
        expect(updated?.status).toBe('OPEN');

        // Worker delivers remaining 30 (overshoot check implicit)
        BlackboardDispatcher.claimJob(faction, { id: 'a1' } as any, updated!, 30);
        BlackboardDispatcher.reportProgress(faction, 'j1', 30);

        const finished = jobPool.getJob('j1');
        expect(finished?.status).toBe('COMPLETED');
    });
});
