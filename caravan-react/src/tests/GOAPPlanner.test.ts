import { describe, test, expect, beforeEach } from 'vitest';
import { GOAPPlanner } from '../simulation/ai/GOAPPlanner';
import { JobPool } from '../simulation/ai/JobPool';
import { Faction, FactionBlackboard, WorldState, Settlement } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';

describe('GOAPPlanner', () => {
    let faction: Faction;
    let jobPool: JobPool;
    let config: GameConfig;
    let state: WorldState;

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
        config = {
            ...DEFAULT_CONFIG,
            costs: {
                ...DEFAULT_CONFIG.costs,
                agents: {
                    ...DEFAULT_CONFIG.costs.agents,
                    Villager: { Food: 50 },
                    Settler: { Food: 100, Timber: 100 }
                }
            }
        };

        // Mock State
        state = {
            tick: 0,
            map: {},
            settlements: {
                's1': {
                    id: 's1',
                    ownerId: 'Faction1',
                    tier: 0,
                    stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
                    hexId: '0,0',
                    population: 10,
                    name: 'Settlement 1'
                } as unknown as Settlement
            },
            agents: {},
            factions: {},
            width: 10,
            height: 10
        };
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

        // Ensure verify logic treats missing building cost as simple fallback
        // We mocked config defaults in Planner implementation, avoiding crash
        GOAPPlanner.plan(faction, jobPool, state, config);

        const jobs = jobPool.getAllJobs();
        // Should create COLLECT Stone job (since stockpile is 0)
        const stoneJob = jobs.find(j => j.type === 'COLLECT' && j.resource === 'Stone');
        expect(stoneJob).toBeDefined();
        expect(stoneJob?.urgency).toBe('HIGH');
        expect(stoneJob?.priority).toBe(0.9);
    });

    test('should SUM priorities for shared resource needs', () => {
        // Setup: Two desires both needing Timber
        // 1. SETTLER (Score 0.5) -> Needs 100 Timber
        // 2. BUILD_SMITHY (Score 0.3) -> Needs 100 Timber (default)
        // Total Timber Need: 200. Total Priority: 0.8.

        // Mock stockpile 0
        state.settlements['s1'].stockpile.Timber = 0;

        faction.blackboard!.desires = [
            { settlementId: 's1', type: 'SETTLER', score: 0.5, needs: ['Timber'] },
            { settlementId: 's1', type: 'BUILD_SMITHY', score: 0.3, needs: ['Timber'] }
        ];

        GOAPPlanner.plan(faction, jobPool, state, config);

        const jobs = jobPool.getAllJobs();
        const timberJob = jobs.find(j => j.type === 'COLLECT' && j.resource === 'Timber');

        expect(timberJob).toBeDefined();
        // The core requirement: Priority should be Sum (0.5 + 0.3 = 0.8)
        expect(timberJob?.priority).toBeCloseTo(0.8, 5);
        // And volume should be sum of deficits (100 + 100 = 200 assuming defaults)
        // Settlement cost is 100. Smithy default is 100.
        expect(timberJob?.targetVolume).toBeGreaterThanOrEqual(200);
    });
});
