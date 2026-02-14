
import { describe, it, expect } from 'vitest';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { Pathfinding } from '../simulation/Pathfinding';
import { HexUtils } from '../utils/HexUtils';
import { WorldState, VillagerAgent, HexCell } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';

describe('VillagerStress', () => {
    it('should calculate valid path between distinct hexes', () => {
        const start = HexUtils.create(-4, 16);
        const end = HexUtils.create(-6, 16);
        const dummyMap: Record<string, HexCell> = {};

        // Fill map between -4,16 and -6,16
        // Path: -4,16 -> -5,16 -> -6,16
        const keys = ['-4,16', '-5,16', '-6,16'];
        keys.forEach(k => {
            const [q, r] = k.split(',').map(Number);
            dummyMap[k] = {
                id: k,
                coordinate: HexUtils.create(q, r),
                terrain: 'Plains',
                resources: {},
                ownerId: 'p1'
            } as HexCell;
        });

        // Clear cache to ensure fresh run
        Pathfinding.clearCache();

        const path = Pathfinding.findPath(start, end, dummyMap, DEFAULT_CONFIG);

        expect(path).toBeDefined();
        // Distance is 2
        // Path should have 2 steps (excluding start)
        expect(path?.length).toBeGreaterThan(0);
        expect(path?.length).toBe(2);
    });

    it('should recover from empty path state while BUSY', () => {
        const start = HexUtils.create(-4, 16);
        const end = HexUtils.create(-6, 16); // Dist 2

        const agent: VillagerAgent = {
            id: 'v1',
            type: 'Villager',
            position: start,
            status: 'BUSY',
            activity: 'GATHER', // Waiting to gather
            gatherTarget: end,
            path: [], // CORRUPT STATE: Empty path but not at target
            cargo: {},
            homeId: 'settlement1',
            canMove: true
        } as unknown as VillagerAgent;

        const state: WorldState = {
            map: {},
            agents: { 'v1': agent },
            settlements: {},
            factions: {},
            tick: 100
        } as unknown as WorldState;

        // Populate map
        ['-4,16', '-5,16', '-6,16'].forEach(k => {
            const [q, r] = k.split(',').map(Number);
            state.map[k] = {
                id: k,
                coordinate: HexUtils.create(q, r),
                terrain: 'Plains',
                resources: { Timber: 100 },
                ownerId: 'p1'
            } as HexCell;
        });

        // Run update - Expect repath
        VillagerSystem.handleGather(state, agent, DEFAULT_CONFIG);

        expect(agent.path).toBeDefined();
        expect(agent.path.length).toBeGreaterThan(0);
        expect(agent.activity).toBe('MOVING'); // Should switch to moving
    });
});
