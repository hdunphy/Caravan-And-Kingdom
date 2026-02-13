
import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, Faction, HexCell, VillagerAgent } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { JobPool } from '../simulation/ai/JobPool';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';

describe('Villager Idling & Job Saturation', () => {
    let state: WorldState;
    let faction: Faction;
    let settlement: Settlement;
    let jobPool: JobPool;

    beforeEach(() => {
        jobPool = new JobPool('p1');
        faction = {
            id: 'p1',
            name: 'Player',
            color: 'blue',
            jobPool: jobPool,
            blackboard: { stances: { expand: 0.5, exploit: 0.5 }, criticalShortages: [], targetedHexes: [] } as any
        } as Faction;

        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: { Timber: 2000 } } as HexCell
            },
            settlements: {},
            agents: {},
            factions: { 'p1': faction },
            width: 10,
            height: 10
        } as any;

        settlement = {
            id: 's1',
            ownerId: 'p1',
            hexId: '0,0',
            controlledHexIds: ['0,0'],
            availableVillagers: 100, // Enough for tests
            stockpile: { Timber: 0 },
            resourceGoals: { Timber: 1000 },
            unreachableHexes: {}
        } as any;
        state.settlements['s1'] = settlement;
    });

    it('should allow multiple villagers to claim a LARGE job', () => {
        // Create a large job directly
        const jobId = 'job-large';
        jobPool.addJob({
            jobId,
            factionId: 'p1',
            sourceId: 's1',
            type: 'COLLECT',
            resource: 'Timber',
            priority: 10,
            urgency: 'HIGH',
            targetVolume: 1000, // Huge volume
            assignedVolume: 0,
            status: 'OPEN',
            targetHexId: '0,0' // Gather at home (simulation)
        });

        // Spawn 10 villagers
        const agents: VillagerAgent[] = [];
        for (let i = 0; i < 10; i++) {
            const agent = VillagerSystem.spawnVillager(state, 's1', '0,0', DEFAULT_CONFIG, 'IDLE')!;
            agents.push(agent);
        }

        // Run Logic
        agents.forEach(agent => {
            VillagerSystem.manageIdleAnt(state, agent, settlement, DEFAULT_CONFIG);
        });

        // Expect ALL 10 to be busy
        const busyCount = agents.filter(a => a.jobId === jobId).length;
        expect(busyCount).toBe(10);

        // Assigned volume should be 10 * 12 (capacity) = 120
        const job = jobPool.getJob(jobId);
        expect(job?.assignedVolume).toBe(120);
        expect(job?.status).toBe('OPEN');
    });

    it('should saturate a SMALL job and leave others idle', () => {
        // Create a small job
        const jobId = 'job-small';
        jobPool.addJob({
            jobId,
            factionId: 'p1',
            sourceId: 's1',
            type: 'COLLECT',
            resource: 'Timber',
            priority: 10,
            urgency: 'HIGH',
            targetVolume: 10, // Small volume
            assignedVolume: 0,
            status: 'OPEN',
            targetHexId: '0,0'
        });

        // Spawn 5 villagers
        const agents: VillagerAgent[] = [];
        for (let i = 0; i < 5; i++) {
            const agent = VillagerSystem.spawnVillager(state, 's1', '0,0', DEFAULT_CONFIG, 'IDLE')!;
            agents.push(agent);
        }

        // Run Logic
        agents.forEach(agent => {
            VillagerSystem.manageIdleAnt(state, agent, settlement, DEFAULT_CONFIG);
        });

        // Expect 1 to be busy, 4 IDLE
        const busyCount = agents.filter(a => a.jobId === jobId).length;
        expect(busyCount).toBe(1);

        const idleCount = agents.filter(a => a.status === 'IDLE').length;
        expect(idleCount).toBe(4);

        const job = jobPool.getJob(jobId);
        expect(job?.status).toBe('SATURATED');
    });
});
