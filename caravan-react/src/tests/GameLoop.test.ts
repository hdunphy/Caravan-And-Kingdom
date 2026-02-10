import { describe, it, expect, beforeEach } from 'vitest';
import { GameLoop } from '../simulation/GameLoop';
import { createInitialState } from '../simulation/WorldState';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('GameLoop', () => {
    let loop: GameLoop;
    let state: any;

    beforeEach(() => {
        state = createInitialState();
        loop = new GameLoop(state, DEFAULT_CONFIG);
    });

    it('should increment tick on every update', () => {
        const initialTick = state.tick;
        loop.tick();
        expect(state.tick).toBe(initialTick + 1);
    });

    it('should run economy systems on resource intervals', () => {
        const interval = DEFAULT_CONFIG.simulation.resourceTickInterval;

        // Fast forward to just before interval
        for (let i = 0; i < interval - 1; i++) {
            loop.tick();
        }

        // const initialGold = 0; // Baseline
        state.settlements['test'] = {
            id: 'test',
            name: 'Test',
            population: 100,
            stockpile: { Food: 100, Gold: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0 },
            controlledHexIds: [],
            buildings: [],
            tier: 0
        };

        loop.tick(); // This should trigger economy (tick == interval)

        // Metabolism system adds gold based on pop
        expect(state.settlements['test'].stockpile.Gold).toBeGreaterThan(0);
    });
});
