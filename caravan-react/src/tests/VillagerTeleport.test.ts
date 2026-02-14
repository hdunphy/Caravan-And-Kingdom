
import { describe, it, expect, beforeEach } from 'vitest';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { Pathfinding } from '../simulation/Pathfinding';
import { WorldState, VillagerAgent, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Villager Teleportation Bug', () => {
    let state: WorldState;
    let agent: VillagerAgent;
    let home: Settlement;

    beforeEach(() => {
        // Clear cache
        Pathfinding.clearCache();

        // Setup: Line of 3 hexes: A(0,0) - B(1,-1) - C(2,-2)
        // Home at A. Resource at C.
        state = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains' },
                '1,-1': { id: '1,-1', coordinate: { q: 1, r: -1, s: 0 }, terrain: 'Plains' },
                '2,-2': { id: '2,-2', coordinate: { q: 2, r: -2, s: 0 }, terrain: 'Plains' }
            },
            settlements: {},
            agents: {},
            factions: {},
            tick: 0,
            width: 10,
            height: 10
        } as any;

        home = {
            id: 's1',
            hexId: '0,0',
            ownerId: 'p1',
            availableVillagers: 0,
            stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 }
        } as any;
        state.settlements['s1'] = home;

        agent = {
            id: 'v1',
            type: 'Villager',
            ownerId: 'p1',
            homeId: 's1',
            position: { q: 2, r: -2, s: 0 }, // At Resource (C)
            target: null,
            path: [],
            cargo: { Food: 10 },
            status: 'BUSY',
            mission: 'GATHER',
            gatherTarget: { q: 2, r: -2, s: 0 },
            activity: 'IDLE'
        } as any;
        state.agents['v1'] = agent;
    });

    it('should find a path home and not teleport (despawn) immediately', () => {
        // Simulate "Arrived at Resource" logic by calling returnHome directly,
        // or simulating handleGather completion.

        // Let's call returnHome directly as that's where the teleport logic resides.
        VillagerSystem.returnHome(state, agent, DEFAULT_CONFIG);

        // Expectation:
        // 1. Agent should STILL exist (not deleted)
        expect(state.agents['v1']).toBeDefined();

        // 2. Agent should have a path
        expect(agent.path.length).toBeGreaterThan(0);

        // 3. Status should be RETURNING
        expect(agent.status).toBe('RETURNING');

        // 4. Target should be Home
        expect(agent.target).toEqual({ q: 0, r: 0, s: 0 });

        // verify path correctness (C -> B -> A)
        // Path does not include start node. So [B, A]
        expect(agent.path[agent.path.length - 1]).toEqual({ q: 0, r: 0, s: 0 });
    });

    it('should teleport only if path is truly blocked', () => {
        // Bloc middle hex
        delete state.map['1,-1'];

        VillagerSystem.returnHome(state, agent, DEFAULT_CONFIG);

        // Expectation: NOT Despawned. Should be IDLE.
        expect(state.agents['v1']).toBeDefined();
        expect(agent.status).toBe('IDLE');
        expect(home.availableVillagers).toBe(0);
    });
});
