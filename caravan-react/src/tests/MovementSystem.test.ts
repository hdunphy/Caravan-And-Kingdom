import { describe, it, expect, beforeEach } from 'vitest';
import { MovementSystem } from '../simulation/systems/MovementSystem';
import { WorldState, AgentEntity } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('MovementSystem', () => {
    let state: WorldState;
    let agent: any;

    beforeEach(() => {
        agent = {
            id: 'a1',
            type: 'Caravan',
            ownerId: 'p1',
            position: { q: 0, r: 0, s: 0 },
            target: { q: 1, r: 0, s: -1 },
            path: [{ q: 1, r: 0, s: -1 }],
            cargo: {},
            integrity: 100,
            status: 'BUSY',
            movementProgress: 0
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: null, resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: null, resources: {} }
            },
            settlements: {},
            agents: { 'a1': agent },
            factions: {},
            width: 2,
            height: 1
        };
    });

    it('should progress movement and move to next hex when cost reached', () => {
        const speed = DEFAULT_CONFIG.costs.movement; // 1.0
        const terrainCost = DEFAULT_CONFIG.costs.terrain.Plains; // 1.0

        MovementSystem.update(state, DEFAULT_CONFIG);

        // Progress was 0, speed is 1.0, cost is 1.0. Should move.
        expect(agent.position.q).toBe(1);
        expect(agent.path.length).toBe(0);
        expect(agent.target).toBeNull();
    });

    it('should take multiple ticks for difficult terrain', () => {
        state.map['1,0'].terrain = 'Mountains';
        // const speed = 1.0;
        // const terrainCost = DEFAULT_CONFIG.costs.terrain.Mountains; // 3.0

        MovementSystem.update(state, DEFAULT_CONFIG);
        expect(agent.position.q).toBe(0); // Still at start
        expect(agent.movementProgress).toBe(1.0);

        MovementSystem.update(state, DEFAULT_CONFIG);
        expect(agent.position.q).toBe(0); // Still at start
        expect(agent.movementProgress).toBe(2.0);

        MovementSystem.update(state, DEFAULT_CONFIG);
        expect(agent.position.q).toBe(1); // Moved!
        expect(agent.movementProgress).toBe(0);
    });

    it('should respect wait ticks (loading/unloading)', () => {
        agent.waitTicks = 5;
        MovementSystem.update(state, DEFAULT_CONFIG);

        expect(agent.position.q).toBe(0);
        expect(agent.movementProgress).toBe(0);
    });
});
