
import { describe, it, expect, beforeEach } from 'vitest';
import { GOAPPlanner } from '../simulation/ai/GOAPPlanner';
import { JobPool } from '../simulation/ai/JobPool';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { WorldState, Faction, Settlement } from '../types/WorldTypes';

describe('GOAPPlanner - Upgrade Costs', () => {
    let state: WorldState;
    let faction: Faction;
    let settlement: Settlement;
    let jobPool: JobPool;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'Capital',
            ownerId: 'f1',
            hexId: '0,0',
            population: 100,
            tier: 0, // Village
            integrity: 100,
            stockpile: { Food: 500, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            buildings: [],
            controlledHexIds: [],
            availableVillagers: 5,
            unreachableHexes: {},
            lastGrowth: 0,
            popHistory: [],
            role: 'GENERAL'
        } as Settlement;

        jobPool = new JobPool('f1');

        faction = {
            id: 'f1',
            name: 'Faction 1',
            color: 'blue',
            blackboard: {
                factionId: 'f1',
                stances: { expand: 0, exploit: 1 },
                criticalShortages: [],
                targetedHexes: [],
                desires: [] // Will be populated
            },
            jobPool: jobPool
        } as unknown as Faction;

        state = {
            tick: 0,
            map: {},
            settlements: { s1: settlement },
            agents: {},
            factions: { f1: faction }
        } as WorldState;
    });

    it('should correctly map Upgrade costs and exclude non-resources like popCap', () => {
        // Setup UPGRADE desire
        faction.blackboard!.desires = [{
            settlementId: 's1',
            type: 'UPGRADE',
            score: 1.0,
            needs: ['Timber', 'Stone']
        }];

        // Execute Planner
        GOAPPlanner.plan(faction, jobPool, state, DEFAULT_CONFIG);

        // Check JobPool for COLLECT jobs
        // villageToTown costs: Timber: 300, Stone: 150
        const timberJob = jobPool.getJob('f1-s1-COLLECT-Timber');
        const stoneJob = jobPool.getJob('f1-s1-COLLECT-Stone');
        const popCapJob = jobPool.getJob('f1-s1-COLLECT-popCap');
        const costTimberJob = jobPool.getJob('f1-s1-COLLECT-costTimber');

        expect(timberJob).toBeDefined();
        expect(timberJob?.targetVolume).toBe(300); // Deficit (0 stock vs 300 cost)

        expect(stoneJob).toBeDefined();
        expect(stoneJob?.targetVolume).toBe(150);

        // IMPORTANT: Verify invalid keys are NOT present
        expect(popCapJob).toBeUndefined();
        expect(costTimberJob).toBeUndefined();
    });
});
