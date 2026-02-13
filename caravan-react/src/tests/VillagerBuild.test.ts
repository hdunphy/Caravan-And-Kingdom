import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { JobPool } from '../simulation/ai/JobPool';
import { Faction, WorldState, VillagerAgent, JobTicket, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('VillagerSystem - Build Mission', () => {
    let state: WorldState;
    let faction: Faction;
    let jobPool: JobPool;
    let agent: VillagerAgent;
    let settlement: Settlement;

    beforeEach(() => {
        jobPool = new JobPool('F1');
        faction = {
            id: 'F1',
            name: 'Test Faction',
            color: '#000',
            jobPool: jobPool
        } as any;

        settlement = {
            id: 's1',
            ownerId: 'F1',
            hexId: '0,0',
            stockpile: { Food: 100, Timber: 100, Stone: 100, Ore: 100, Tools: 100, Gold: 100 },
            availableVillagers: 0
        } as any;

        agent = {
            id: 'v1',
            type: 'Villager',
            ownerId: 'F1',
            homeId: 's1',
            position: { q: 10, r: 10, s: -20 }, // Away from target
            cargo: {},
            integrity: 100,
            activity: 'IDLE',
            status: 'IDLE'
        } as any;

        state = {
            map: {
                '0,0': { coordinate: { q: 0, r: 0, s: 0 } },
                '1,-1': { coordinate: { q: 1, r: -1, s: 0 } }, // Adjacent
                '10,10': { coordinate: { q: 10, r: 10, s: -20 } }
            },
            settlements: { 's1': settlement },
            agents: { 'v1': agent },
            factions: { 'F1': faction },
            tick: 0,
            width: 100,
            height: 100
        } as any;
    });

    test('should report progress when building at target', () => {
        // 1. Create Job
        const job: JobTicket = {
            jobId: 'build_job',
            factionId: 'F1',
            sourceId: 's1',
            type: 'BUILD',
            priority: 1.0,
            targetVolume: 100,
            assignedVolume: 20, // Pre-assigned
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: '0,0' // Target is at settlement
        };
        jobPool.addJob(job);

        // 2. Setup Agent
        agent.jobId = 'build_job';
        agent.mission = 'BUILD';
        agent.gatherTarget = { q: 0, r: 0, s: 0 }; // Target Location
        agent.position = { q: 0, r: 0, s: 0 }; // At Target

        // 3. Spy on reportProgress (optional, but let's trust state change)

        // 4. Run handleBuild
        VillagerSystem.handleBuild(state, agent, DEFAULT_CONFIG);

        // 5. Verify Progress Reported
        const updatedJob = jobPool.getJob('build_job');
        // Initial Target 100. WorkAmount is 10. New Target should be 90.
        expect(updatedJob?.targetVolume).toBe(90);
        // And assignedVolume should decrease by WorkAmount? 
        // Wait, reportProgress logic:
        // job.assignedVolume = Math.max(0, job.assignedVolume - amountDone);
        // job.targetVolume = Math.max(0, job.targetVolume - amountDone);

        expect(updatedJob?.assignedVolume).toBe(10); // 20 - 10
    });

    test('should return home after building', () => {
        const job: JobTicket = {
            jobId: 'build_job',
            factionId: 'F1',
            sourceId: 's1',
            type: 'BUILD',
            priority: 1.0,
            targetVolume: 100,
            assignedVolume: 20,
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: '0,0'
        };
        jobPool.addJob(job);

        agent.jobId = 'build_job';
        agent.mission = 'BUILD';
        agent.gatherTarget = { q: 0, r: 0, s: 0 };
        agent.position = { q: 0, r: 0, s: 0 };

        VillagerSystem.handleBuild(state, agent, DEFAULT_CONFIG);

        // Should be returning home
        expect(agent.status).toBe('RETURNING');
        expect(agent.activity).toBe('MOVING');
    });

    test('should move to target if not there', () => {
        const job: JobTicket = {
            jobId: 'build_job',
            factionId: 'F1',
            sourceId: 's1',
            type: 'BUILD',
            priority: 1.0,
            targetVolume: 100,
            assignedVolume: 20,
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: '0,0'
        };
        jobPool.addJob(job);

        agent.jobId = 'build_job';
        agent.mission = 'BUILD';
        agent.gatherTarget = { q: 0, r: 0, s: 0 };
        agent.position = { q: 1, r: -1, s: 0 }; // Adjacent

        VillagerSystem.handleBuild(state, agent, DEFAULT_CONFIG);

        expect(agent.activity).toBe('MOVING'); // Should process movement
        expect(agent.path.length).toBeGreaterThan(0);
    });
});
