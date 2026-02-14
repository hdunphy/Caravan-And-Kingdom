import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, Faction, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { RecruitStrategy } from '../simulation/ai/RecruitStrategy';
import { AIController } from '../simulation/ai/AIController';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { JobPool } from '../simulation/ai/JobPool';

describe('Villager Recruitment & Labor Supply System', () => {
    let state: WorldState;
    let controller: AIController;

    beforeEach(() => {
        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell
            },
            settlements: {},
            agents: {},
            factions: {
                'p1': { id: 'p1', name: 'Player', color: 'blue' } as Faction
            },
            width: 10,
            height: 10
        };
        state.factions['p1'].jobPool = new JobPool('p1');
        controller = new AIController();
    });

    it('should trigger RECRUIT_VILLAGER when population ratio allows and food is safe', () => {
        // 1. Setup settlement with 100 pop and plenty of food
        // popRatio is 50, so maxVillagers = 100 / 50 = 2.
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 2000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 0, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        // 2. Run RecruitStrategy
        const strategy = new RecruitStrategy();
        const actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');

        // Expect 1 recruitment action
        expect(actions.length).toBeGreaterThan(0);
        expect(actions[0].type).toBe('RECRUIT_VILLAGER');
    });

    it('should execute RECRUIT_VILLAGER and increment availableVillagers pool', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 2000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 0, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        // Force recruitment via controller update
        // We need to bypass the interval check for the test
        (controller as any).processFaction('p1', state, DEFAULT_CONFIG);

        // Expect availableVillagers to have increased
        expect(s1.availableVillagers).toBeGreaterThan(0);
        expect(s1.stockpile.Food).toBeLessThan(2000); // Cost deducted
    });

    it('should block recruitment if food is below safety threshold', () => {
        // Safe Level for 100 pop is ~200 food. 
        // We give them exactly enough to afford the recruit (100) but not hit safety.
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 110, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 0, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        const strategy = new RecruitStrategy();
        const actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');

        // Expect 0 actions because safetyFactor is not met
        expect(actions.length).toBe(0);
    });

    it('should spawn villagers as Agents when availableVillagers > 0', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 3, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        // Run VillagerSystem
        VillagerSystem.update(state, DEFAULT_CONFIG);

        // 1. availableVillagers should be drained
        expect(s1.availableVillagers).toBe(0);

        // 2. Agents should exist in the world
        const agents = Object.values(state.agents).filter(a => a.type === 'Villager' && (a as any).homeId === 's1');
        expect(agents.length).toBe(3);
    });

    it('should respect the population-based maxVillagers cap', () => {
        // popRatio is 25 (Config). Pop 50. Ratio Cap = 2.
        // BaseVillagers is 4 (Config). Max(4, 2) = 4.
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 50, tier: 1,
            stockpile: { Food: 5000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 4, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        const strategy = new RecruitStrategy();
        const actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');

        // Already have 2 available, so should not recruit more
        expect(actions.length).toBe(0);
    });
});
