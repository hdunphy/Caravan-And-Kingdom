import { describe, it, expect, beforeEach } from 'vitest';
import { IndustrySystem } from '../simulation/systems/IndustrySystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('IndustrySystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'p1',
            population: 100,
            stockpile: { Food: 1000, Timber: 1000, Stone: 0, Ore: 1000, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 1,
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
            map: { '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } },
            settlements: { 's1': settlement },
            agents: {},
            factions: {},
            width: 1,
            height: 1
        };
    });

    it('should produce tools when below target ratio and materials exist', () => {
        // Target ratio 0.2, pop 100 => 20 tools
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(1);
        expect(settlement.stockpile.Timber).toBeLessThan(1000);
        expect(settlement.stockpile.Ore).toBeLessThan(1000);
    });

    it('should respect surplus threshold for production when goal is not TOOLS', () => {
        settlement.currentGoal = 'UPGRADE';
        settlement.stockpile.Timber = 50; // threshold is 50
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(0);
    });

    it('should produce even if low resources if goal is TOOLS', () => {
        settlement.currentGoal = 'TOOLS';
        settlement.stockpile.Timber = 10; // cost is 5, surplus 50 is ignored
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(1);
    });
});
