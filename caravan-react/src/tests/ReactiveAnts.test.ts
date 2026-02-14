<<<<<<< Updated upstream
import { Settlement, WorldState, Faction } from '../types/WorldTypes.ts';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig.ts';
import { VillagerSystem } from '../simulation/systems/VillagerSystem.ts';
import { HexUtils } from '../utils/HexUtils.ts';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor.ts';
import { GOAPPlanner } from '../simulation/ai/GOAPPlanner.ts';
import { JobPool } from '../simulation/ai/JobPool.ts';

const mockConfig: GameConfig = {
    ...DEFAULT_CONFIG,
    costs: {
        ...DEFAULT_CONFIG.costs,
        villagers: {
            ...DEFAULT_CONFIG.costs.villagers,
            range: 3
        },
        agents: {
            ...DEFAULT_CONFIG.costs.agents,
            Villager: { Food: 50 }
        }
    }
};

describe('Reactive Ants (Autonomous Villagers)', () => {
    let state: WorldState;
    let faction: Faction;
    let jobPool: JobPool;

    beforeEach(() => {
        jobPool = new JobPool('f1');
        faction = {
            id: 'f1',
            name: 'Faction 1',
            color: '#000',
            blackboard: {
                factionId: 'f1',
                stances: { expand: 0, exploit: 1 },
                criticalShortages: [],
                targetedHexes: [],
                desires: []
            },
            jobPool: jobPool
        };

        state = {
            tick: 1,
            map: {},
            settlements: {},
            agents: {},
            factions: { 'f1': faction },
            width: 10,
            height: 10
        };
    });

    function advanceAI(s: Settlement) {
        faction.blackboard!.desires = [];
        SettlementGovernor.evaluate(s, faction, state, mockConfig);
        GOAPPlanner.plan(faction, jobPool, state, mockConfig);
    }

    it('should auto-dispatch to food when stockpile is empty', () => {
        const s: Settlement = {
            id: 's1', name: 'Ant Home', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 0, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            resourceGoals: { Food: 500, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '1,0'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: { Food: 50 } };

        // 1. Generate Jobs
        advanceAI(s);

        // 2. Run System Update (Claim & Move)
        VillagerSystem.update(state, mockConfig);

        // Expect 1 active villager agent targeting 1,0
        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1);
        expect(HexUtils.getID(agents[0].target!)).toBe('1,0');
    });

    it('should ignore water tiles even if they have high-pressure resources', () => {
        const s: Settlement = {
            id: 's1', name: 'Beach House', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 0, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            resourceGoals: { Food: 500, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '0,1'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Water', ownerId: 'f1', resources: { Food: 500 } }; // Lots of fish!

        advanceAI(s);
        VillagerSystem.update(state, mockConfig);

        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1); // Spawns from pool but stays IDLE
        expect(agents[0].status).toBe('IDLE');
    });

    it('should shift to timber when food goal is met', () => {
        const s: Settlement = {
            id: 's1', name: 'Resource Hub', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 600, Timber: 0, Stone: 100, Ore: 0, Tools: 0, Gold: 0 }, // Food goal met
            resourceGoals: { Food: 500, Timber: 500, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '1,0', '0,1'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: { Food: 50 } };
        state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Forest', ownerId: 'f1', resources: { Timber: 50 } };

        advanceAI(s);
        VillagerSystem.update(state, mockConfig);

        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1);
        expect(HexUtils.getID(agents[0].target!)).toBe('0,1'); // Targeted timber
    });
});
=======
import { describe, it, expect, beforeEach } from 'vitest';
import { Settlement, WorldState } from '../types/WorldTypes.ts';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig.ts';
import { VillagerSystem } from '../simulation/systems/VillagerSystem.ts';
import { HexUtils } from '../utils/HexUtils.ts';

const mockConfig: GameConfig = {
    ...DEFAULT_CONFIG,
    costs: {
        ...DEFAULT_CONFIG.costs,
        villagers: {
            ...DEFAULT_CONFIG.costs.villagers,
            range: 3
        }
    }
};

describe('Reactive Ants (Autonomous Villagers)', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 1,
            map: {},
            settlements: {},
            agents: {},
            factions: { 'f1': { id: 'f1', name: 'Faction 1', color: '#000' } },
            width: 10,
            height: 10
        };
    });

    it('should auto-dispatch to food when stockpile is empty', () => {
        const s: Settlement = {
            id: 's1', name: 'Ant Home', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 0, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            resourceGoals: { Food: 500, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '1,0'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: { Food: 50 } };

        // Run System Update
        VillagerSystem.update(state, mockConfig);

        // Expect 1 active villager agent targeting 1,0
        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1);
        expect(HexUtils.getID(agents[0].target!)).toBe('1,0');
    });

    it('should ignore water tiles even if they have high-pressure resources', () => {
        const s: Settlement = {
            id: 's1', name: 'Beach House', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 0, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            resourceGoals: { Food: 500, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '0,1'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Water', ownerId: 'f1', resources: { Food: 500 } }; // Lots of fish!

        VillagerSystem.update(state, mockConfig);

        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1); // Spawns from pool but stays IDLE
        expect(agents[0].status).toBe('IDLE');
    });

    it('should shift to timber when food goal is met', () => {
        const s: Settlement = {
            id: 's1', name: 'Resource Hub', hexId: '0,0', ownerId: 'f1',
            population: 10, stockpile: { Food: 600, Timber: 0, Stone: 100, Ore: 0, Tools: 0, Gold: 0 }, // Food goal met
            resourceGoals: { Food: 500, Timber: 500, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100, tier: 0, jobCap: 10, workingPop: 0, availableVillagers: 1,
            controlledHexIds: ['0,0', '1,0', '0,1'], buildings: [], popHistory: [], role: 'GENERAL'
        };
        state.settlements['s1'] = s;
        state.map['0,0'] = { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} };
        state.map['1,0'] = { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'f1', resources: { Food: 50 } };
        state.map['0,1'] = { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Forest', ownerId: 'f1', resources: { Timber: 50 } };

        VillagerSystem.update(state, mockConfig);

        const agents = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(agents.length).toBe(1);
        expect(HexUtils.getID(agents[0].target!)).toBe('0,1'); // Targeted timber
    });
});
>>>>>>> Stashed changes
