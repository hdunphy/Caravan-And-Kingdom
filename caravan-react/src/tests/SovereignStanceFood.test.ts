import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, Faction, HexCell, VillagerAgent } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { SovereignAI } from '../simulation/ai/SovereignAI';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { GOAPPlanner } from '../simulation/ai/GOAPPlanner';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { JobPool } from '../simulation/ai/JobPool';

describe('Sovereign Stance & Food Stagnation Bug', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: { Food: 100 } } as HexCell,
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'p1', resources: { Food: 100 } } as HexCell
            },
            settlements: {},
            agents: {},
            factions: {
                'p1': { id: 'p1', name: 'Player', color: 'blue', blackboard: { stances: { expand: 0.5, exploit: 0.5 }, criticalShortages: [], targetedHexes: [] } as any }
            },
            width: 10,
            height: 10
        };
        state.factions['p1'].jobPool = new JobPool('p1');
    });

    it('should reproduce idle villagers when food is low and stances shift to EXPLOIT', () => {
        // 1. Setup a settlement with LOW FOOD
        // Consumption will be 100 * 0.1 = 10.
        // Safe Level (20 ticks) = 200.
        // Stockpile = 50 (Critical).
        const s1: Settlement = {
            id: 's1',
            name: 'Starving Town',
            ownerId: 'p1',
            hexId: '0,0',
            population: 100,
            tier: 1,
            stockpile: { Food: 50, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0', '1,0'],
            availableVillagers: 10,
            buildings: [],
            integrity: 100,
            jobCap: 100,
            workingPop: 100,
            popHistory: [],
            role: 'GENERAL'
        };
        state.settlements['s1'] = s1;

        // 2. Run Sovereign AI
        // Expected: surplusRatio < 0.5 -> Stance becomes EXPLOIT (1.0)
        SovereignAI.evaluate(state.factions['p1'], state, DEFAULT_CONFIG);
        expect(state.factions['p1'].blackboard?.stances.exploit).toBe(1.0);

        // 3. Run Settlement Governor
        // Expected: Low food -> surviveMode = true.
        // Low food -> No RECRUIT desire.
        // Exploit -> might want UPGRADE but needs resources first.
        SettlementGovernor.evaluate(s1, state.factions['p1'], state, DEFAULT_CONFIG);

        // 4. Run GOAP Planner
        // Expected: If no active desires REQUIRE food, no COLLECT Food job is created.
        GOAPPlanner.plan(state.factions['p1'], state.factions['p1'].jobPool, state, DEFAULT_CONFIG);

        const foodJob = state.factions['p1'].jobPool.getAllJobs().find((j: any) => j.resource === 'Food');

        // 5. Check if villagers go idle
        const agent = VillagerSystem.spawnVillager(state, 's1', '0,0', DEFAULT_CONFIG, 'IDLE')!;
        VillagerSystem.manageIdleAnt(state, agent, s1, DEFAULT_CONFIG);

        console.log(`[Stagnation Test] Stance: Exploit=${state.factions['p1'].blackboard?.stances.exploit}, Food Job: ${foodJob ? 'Found' : 'MISSING'}, Agent Mission: ${agent.mission}`);

        // ASSERT: usage of EXPLOIT should not prevent REPLENISH from generating a job
        expect(foodJob).toBeDefined();
        // Agent should pick it up (or be busy with it)
        // If agent was just spawned, he might pick it up on next tick. 
        // But manageIdleAnt was called.
        expect(agent.mission).not.toBe('IDLE');
    });
});
