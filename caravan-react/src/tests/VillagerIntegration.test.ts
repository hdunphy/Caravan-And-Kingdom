import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { JobPool } from '../simulation/ai/JobPool';
import { Faction, WorldState, VillagerAgent, Settlement } from '../types/WorldTypes';
import { JobTicket } from '../simulation/ai/AITypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { HexUtils } from '../utils/HexUtils';
import { Pathfinding } from '../simulation/Pathfinding';

describe('Villager Integration Flow', () => {
    let state: WorldState;
    // ...
    let faction: Faction;
    let jobPool: JobPool;
    let agent: VillagerAgent;
    let settlement: Settlement;

    const HOME_HEX = '0,0';
    const TARGET_HEX = '0,2'; // Distance 2

    beforeEach(() => {
        Pathfinding.clearCache();
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
            hexId: HOME_HEX,
            stockpile: { Food: 100, Timber: 100, Stone: 100, Ore: 100, Tools: 100, Gold: 100 },
            availableVillagers: 0,
            controlledHexIds: [HOME_HEX, TARGET_HEX]
        } as any;

        agent = {
            id: 'v1',
            type: 'Villager',
            ownerId: 'F1',
            homeId: 's1',
            position: { q: 0, r: 0, s: 0 },
            cargo: {},
            integrity: 100,
            activity: 'IDLE',
            status: 'IDLE',
            path: []
        } as any;

        state = {
            map: {
                '0,0': { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', resources: { Food: 0 } },
                '0,1': { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains' }, // Path
                '0,2': { coordinate: { q: 0, r: 2, s: -2 }, terrain: 'Plains', resources: { Timber: 100 } }
            },
            settlements: { 's1': settlement },
            agents: { 'v1': agent },
            factions: { 'F1': faction },
            tick: 0,
            width: 100,
            height: 100
        } as any;
    });

    test('Full Flow: COLLECT Job -> Move -> Gather -> Return', () => {
        // 1. Create Job
        const job: JobTicket = {
            jobId: 'collect_wood',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0,
            targetVolume: 50,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH',
            resource: 'Timber',
            targetHexId: TARGET_HEX
        };
        jobPool.addJob(job);

        // 2. Tick 1: Agent should claim job and start moving
        VillagerSystem.update(state, DEFAULT_CONFIG);

        expect(agent.status).toBe('BUSY');
        expect(agent.jobId).toBe('collect_wood');
        expect(agent.activity).toBe('MOVING');
        expect(agent.path.length).toBeGreaterThan(0);
        expect(agent.target).toBeDefined();

        // 3. Simulate Movement (Tick 2-3)
        // Manually move agent along path to target
        while (agent.path.length > 0) {
            agent.position = agent.path.shift()!;
        }

        // Ensure at target (just in case)
        agent.position = state.map[TARGET_HEX].coordinate;

        // Tick Update to Trigger Gather
        VillagerSystem.update(state, DEFAULT_CONFIG);

        // Should have gathered
        expect(agent.cargo.Timber).toBeGreaterThan(0);
        expect(agent.status).toBe('RETURNING');

        // 5. Return Home
        // Manually move back (using path drain or instant)
        // Since we want to test arrival logic, we can just clear path and set pos.
        // But in reality, returnHome sets a path.
        // Let's clear it to simulate "moved all the way".
        agent.path = [];
        agent.position = state.map[HOME_HEX].coordinate;

        // Tick Update to Trigger Deposit
        VillagerSystem.update(state, DEFAULT_CONFIG);

        expect(settlement.stockpile.Timber).toBeGreaterThan(100); // 100 + gathered
        expect(agent.status).toBe('IDLE'); // Should be DESPAWNED usually, or IDLE if pool logic keeps them
        // VillagerSystem logic deletes agent and increments availableVillagers
        expect(state.agents['v1']).toBeUndefined();
        expect(settlement.availableVillagers).toBe(1);

        // Job Progress Check
        const updatedJob = jobPool.getJob('collect_wood');
        expect(updatedJob?.assignedVolume).toBe(0); // Freed
        expect(updatedJob?.targetVolume).toBeLessThan(50); // Worked done
    });

    test('Job Selection: Should pick Job with highest Bid', () => {
        // Add low priority job close by
        const lowPrioJob: JobTicket = {
            jobId: 'low',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 0.1,
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'LOW',
            resource: 'Food',
            targetHexId: TARGET_HEX
        };
        jobPool.addJob(lowPrioJob);

        // Add high priority job
        const highPrioJob: JobTicket = {
            jobId: 'high',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 2.0,
            targetVolume: 100,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH',
            resource: 'Timber',
            targetHexId: TARGET_HEX
        };
        jobPool.addJob(highPrioJob);

        // Tick
        VillagerSystem.update(state, DEFAULT_CONFIG);

        expect(agent.jobId).toBe('high');
    });

    test('Stuck Check: Should not modify state if no path found', () => {
        // Obstruct path by making target inaccessible (Water)
        if (state.map[TARGET_HEX]) {
            state.map[TARGET_HEX].terrain = 'Water';
        }

        const job: JobTicket = {
            jobId: 'impossible',
            factionId: 'F1',
            sourceId: 's1',
            type: 'COLLECT',
            priority: 1.0,
            targetVolume: 50,
            assignedVolume: 0,
            status: 'OPEN',
            urgency: 'HIGH',
            targetHexId: TARGET_HEX
        };
        jobPool.addJob(job);

        VillagerSystem.update(state, DEFAULT_CONFIG);

        // Should NOT claim if path not found?
        // Current logic: Claims -> Dispatches -> Checks Path
        // If path fails, it might release job or stay idle?
        // VillagerSystem.ts:347 dispatchAnt -> path check
        // If path check fails, returns. Job stays claimed? Agent stays IDLE?

        // Let's see what happens
        // Ideally agent.jobId is undefined because dispatch failed? 
        // Or agent.jobId set, but path failed so agent stuck IDLE with job?

        // Wait, manageIdleAnt: claims -> sets agent.jobId = bestJob.jobId -> calls dispatchAnt.
        // If dispatchAnt fails to path, logic does: home.unreachableHexes set.
        // Agent state?
        // dispatchAnt sets status BUSY only if path found.
        // So agent stays with jobId but status IDLE?
        // Next tick? 
        // manageIdleAnt runs again?
        // If status IDLE, manageIdleAnt runs.
        // It sees bestJobs (Dispatcher returns same job because assignedVolume is on THIS agent?).
        // No, assignedVolume is separate.
        // If agent holds job, does Dispatcher know?
        // Dispatcher checks job.assignedVolume. Job has assignedVolume += capacity.
        // If job saturated, getTopAvailableJobs won't return it!
        // So agent stays IDLE, holding the job ID (if not cleared), doing nothing.
        // This is a "STUCK" scenario! 

        // Check if job was released
        const impossibleJob = jobPool.getJob('impossible');
        expect(impossibleJob).toBeDefined();
        expect(impossibleJob?.assignedVolume).toBe(0); // Should be released if unreachable

        // expect(agent.status).toBe('IDLE');
        // expect(agent.jobId).toBe('impossible'); // Validating the bug/behavior
    });
});
