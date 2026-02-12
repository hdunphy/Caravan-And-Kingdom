
import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { Pathfinding } from '../simulation/Pathfinding';
import { Logger } from '../utils/Logger';

// Enable logging for this test
Logger.getInstance().setSilent(false);

describe('Pathfinding Debug', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        // Clear cache
        Pathfinding.clearCache();

        // Setup basic state
        settlement = {
            id: 'debug_settlement',
            name: 'Debug City',
            ownerId: 'player_1',
            hexId: '0,0',
            population: 100,
            stockpile: { Food: 100, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 100 },
            buildings: [],
            availableVillagers: 10,
            tier: 0,
            integrity: 100,
            controlledHexIds: ['0,0'],
            jobCap: 200,
            workingPop: 0,
            popHistory: [],
            role: 'GENERAL'
        };

        state = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: { Food: 100 } },
                '0,1': { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', ownerId: null, resources: { Timber: 100 } },
                '0,2': { id: '0,2', coordinate: { q: 0, r: 2, s: -2 }, terrain: 'Hills', ownerId: null, resources: { Stone: 100 } },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Water', ownerId: null, resources: {} }, // Obstacle
            },
            settlements: { 'debug_settlement': settlement },
            agents: {},
            factions: { 'player_1': { id: 'player_1', name: 'Player', color: 'blue' } },
            tick: 0,
            width: 10,
            height: 10
        };
    });

    it('should successfully spawn a villager to a reachable target', () => {
        // 0,0 -> 0,1 (Directly adjacent)
        const agent = VillagerSystem.spawnVillager(state, settlement.id, '0,1', DEFAULT_CONFIG, 'GATHER');
        expect(agent).not.toBeNull();
        if (agent) {
            console.log(`Spawned agent path: ${JSON.stringify(agent.path)}`);
        }
    });

    it('should successfully pathfind around an obstacle', () => {
        // 0,0 -> 0,2. 
        // 0,0 neighbors: 1,0 (Water), 0,1 (Plains), ...
        // Path should go through 0,1 to reach 0,2?
        // 0,2 neighbors: 0,1...
        // so 0,0 -> 0,1 -> 0,2 is valid.

        const agent = VillagerSystem.spawnVillager(state, settlement.id, '0,2', DEFAULT_CONFIG, 'GATHER');
        expect(agent).not.toBeNull();
        if (agent) {
            console.log(`Spawned agent path (obstacle): ${JSON.stringify(agent.path)}`);
        }
    });

    it('should fail if target is unreachable', () => {
        state.map['0,1'].terrain = 'Water'; // Block the only path to 0,2
        // Now 0,0 -> 1,0 (Water)
        // 0,0 -> 0,1 (Water)
        // 0,0 -> -1,1 ... (not in map)

        const agent = VillagerSystem.spawnVillager(state, settlement.id, '0,2', DEFAULT_CONFIG, 'GATHER');
        expect(agent).toBeNull();
    });
});
