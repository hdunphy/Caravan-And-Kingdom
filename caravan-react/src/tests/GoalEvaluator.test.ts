import { describe, it, expect, beforeEach } from 'vitest';
import { GoalEvaluator } from '../simulation/ai/GoalEvaluator';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('GoalEvaluator', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'p1',
            population: 100,
            stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 0,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            buildings: [],
            popHistory: [],
            role: 'GENERAL'
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} }
            },
            settlements: { 's1': settlement },
            agents: {},
            factions: { 'p1': { id: 'p1', name: 'P1', color: '#f00' } },
            width: 10,
            height: 10
        };
    });

    it('should prioritize SURVIVE when food is critically low', () => {
        settlement.stockpile.Food = 5;
        const goal = GoalEvaluator.evaluate(state, settlement, DEFAULT_CONFIG);
        expect(goal).toBe('SURVIVE');
    });

    it('should stay in SURVIVE mode due to hysteresis', () => {
        settlement.currentGoal = 'SURVIVE';
        // Food is low but slightly above critical
        settlement.stockpile.Food = 60;
        const goal = GoalEvaluator.evaluate(state, settlement, DEFAULT_CONFIG);
        expect(goal).toBe('SURVIVE');
    });

    it('should exit SURVIVE mode when food is abundant', () => {
        settlement.currentGoal = 'SURVIVE';
        settlement.stockpile.Food = 1000;
        const goal = GoalEvaluator.evaluate(state, settlement, DEFAULT_CONFIG);
        expect(goal).not.toBe('SURVIVE');
    });

    it('should prioritize UPGRADE when population is high', () => {
        // Village cap is 200, 80% is 160
        settlement.population = 170;
        const goal = GoalEvaluator.evaluate(state, settlement, DEFAULT_CONFIG);
        expect(goal).toBe('UPGRADE');
    });

    it('should recommend EXPAND when at max tier and spot exists', () => {
        settlement.tier = 2;
        settlement.population = 1000;
        settlement.stockpile.Food = 5000; // Enough to survive so we can expand

        // Ensure a valid expansion spot exists (away from s1)
        state.map['5,5'] = { id: '5,5', coordinate: { q: 5, r: 5, s: -10 }, terrain: 'Plains', ownerId: null, resources: {} };
        // Add neighbors for 5,5
        const neighbors = [{ q: 6, r: 5 }, { q: 5, r: 6 }, { q: 4, r: 6 }, { q: 4, r: 5 }, { q: 5, r: 4 }, { q: 6, r: 4 }];
        neighbors.forEach(n => {
            const id = `${n.q},${n.r}`;
            state.map[id] = { id, coordinate: { ...n, s: -n.q - n.r }, terrain: 'Plains', ownerId: null, resources: {} };
        });

        const goal = GoalEvaluator.evaluate(state, settlement, DEFAULT_CONFIG);
        expect(goal).toBe('EXPAND');
    });
});
