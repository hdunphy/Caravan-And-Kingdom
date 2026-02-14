import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, Faction, HexCell, AgentEntity } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { JobPool } from '../simulation/ai/JobPool';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { HexUtils } from '../utils/HexUtils';

describe('Advanced Job System & Pool Performance', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell,
                '10,0': { id: '10,0', coordinate: { q: 10, r: 0, s: -10 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell
            },
            settlements: {},
            agents: {},
            factions: {
                'p1': { id: 'p1', name: 'Player', color: 'blue' } as Faction
            },
            width: 20,
            height: 20
        };
        state.factions['p1'].jobPool = new JobPool('p1');
    });

    it('Scenario 1: Saturation Recovery - Should reopen job if agent aborts', () => {
        const pool = state.factions['p1'].jobPool as JobPool;
        const jobId = 'j1';
        
        // 1. Create a job with volume 10
        pool.addJob({
            jobId, factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'HIGH', priority: 1.0, targetVolume: 10, assignedVolume: 0, status: 'OPEN'
        });

        const agent: AgentEntity = { id: 'a1', type: 'Villager', position: { q: 0, r: 0, s: 0 }, cargo: {}, ownerId: 'p1' } as any;

        // 2. Agent claims the full volume
        BlackboardDispatcher.claimJob(state.factions['p1'], agent, pool.getJob(jobId)!, 10);
        
        // Status should now be SATURATED
        expect(pool.getJob(jobId)!.status).toBe('SATURATED');

        // 3. Agent "Aborts" (Releases assignment)
        BlackboardDispatcher.releaseAssignment(state.factions['p1'], jobId, 10);

        // Status should return to OPEN
        expect(pool.getJob(jobId)!.status).toBe('OPEN');
        expect(pool.getJob(jobId)!.assignedVolume).toBe(0);
    });

    it('Scenario 2: Distance Bias - Agents should prefer closer jobs', () => {
        const pool = state.factions['p1'].jobPool as JobPool;
        
        // Two identical jobs at different locations
        // Job 1 at 0,0
        pool.addJob({
            jobId: 'close', factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'MEDIUM', priority: 1.0, targetVolume: 100, assignedVolume: 0, status: 'OPEN',
            targetHexId: '0,0'
        });

        // Job 2 at 10,0
        pool.addJob({
            jobId: 'far', factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'MEDIUM', priority: 1.0, targetVolume: 100, assignedVolume: 0, status: 'OPEN',
            targetHexId: '10,0'
        });

        const agent: AgentEntity = { 
            id: 'a1', type: 'Villager', 
            position: { q: 1, r: 0, s: -1 }, // Position 1,0 (Very close to 'close')
            cargo: {}, ownerId: 'p1' 
        } as any;

        // Poll for jobs
        const topJobs = BlackboardDispatcher.getTopAvailableJobs(agent, state.factions['p1'], state, DEFAULT_CONFIG);
        
        // 'close' should be index 0
        expect(topJobs[0].jobId).toBe('close');
    });

    it('Scenario 3: Concurrent Fulfillment - Prevent over-assignment', () => {
        const pool = state.factions['p1'].jobPool as JobPool;
        const jobId = 'limited';
        
        pool.addJob({
            jobId, factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'HIGH', priority: 1.0, targetVolume: 10, assignedVolume: 0, status: 'OPEN'
        });

        const a1: AgentEntity = { id: 'a1', ownerId: 'p1' } as any;
        const a2: AgentEntity = { id: 'a2', ownerId: 'p1' } as any;

        // Agent 1 claims 10
        const success1 = BlackboardDispatcher.claimJob(state.factions['p1'], a1, pool.getJob(jobId)!, 10);
        expect(success1).toBe(true);
        expect(pool.getJob(jobId)!.status).toBe('SATURATED');

        // Agent 2 attempts to claim even 1 unit
        const success2 = BlackboardDispatcher.claimJob(state.factions['p1'], a2, pool.getJob(jobId)!, 1);
        
        // Should fail because status is no longer OPEN
        expect(success2).toBe(false);
    });

    it('Scenario 4: Urgency Weighting - High urgency should override distance slightly', () => {
        const pool = state.factions['p1'].jobPool as JobPool;
        
        // Medium Job (Close: 1 unit away)
        pool.addJob({
            jobId: 'close_med', factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'MEDIUM', priority: 0.5, targetVolume: 100, assignedVolume: 0, status: 'OPEN',
            targetHexId: '0,0'
        });

        // High Urgency Job (Far: 5 units away)
        pool.addJob({
            jobId: 'far_high', factionId: 'p1', sourceId: 's1', type: 'COLLECT',
            urgency: 'HIGH', priority: 1.0, targetVolume: 100, assignedVolume: 0, status: 'OPEN',
            targetHexId: '5,0'
        });

        const agent: AgentEntity = { 
            id: 'a1', type: 'Villager', 
            position: { q: 1, r: 0, s: -1 }, // Position 1,0
            cargo: {}, ownerId: 'p1' 
        } as any;

        const topJobs = BlackboardDispatcher.getTopAvailableJobs(agent, state.factions['p1'], state, DEFAULT_CONFIG);
        
        // Far_high should be preferred due to 2x priority (1.0 vs 0.5)
        expect(topJobs[0].jobId).toBe('far_high');
    });
});
