import { describe, it, expect, beforeEach } from 'vitest';
import { MetabolismSystem } from '../simulation/systems/MetabolismSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('MetabolismSystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 'test-settlement',
            name: 'Test City',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 100,
            stockpile: { Food: 100, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 0,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            buildings: []
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} }
            },
            settlements: { 'test-settlement': settlement },
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: '#0000ff' }
            },
            width: 1,
            height: 1
        };
    });

    it('should consume food and grow when fed', () => {
        const initialPop = settlement.population;
        const consumeRate = DEFAULT_CONFIG.costs.baseConsume; // 0.1
        const growthRate = DEFAULT_CONFIG.costs.growthRate; // 0.008
        
        MetabolismSystem.update(state, DEFAULT_CONFIG);

        expect(settlement.stockpile.Food).toBe(100 - (initialPop * consumeRate));
        // Growth: 100 * 0.008 * (40/100) because maxJobs = 1 hex * 40 = 40.
        // wait, maxLaborPerHex is 40 in DEFAULT_CONFIG.
        // settlement.controlledHexIds.length is 1.
        // maxJobs = 1 * 40 = 40.
        // pressureFactor = 40 / 100 = 0.4.
        // finalGrowthRate = 0.008 * 0.4 = 0.0032.
        // pop += 100 * 0.0032 = 0.32.
        expect(settlement.population).toBeCloseTo(initialPop + (initialPop * growthRate * (40 / initialPop)), 5);
    });

    it('should starve population when out of food', () => {
        settlement.stockpile.Food = 0;
        const initialPop = settlement.population;
        const starvationRate = DEFAULT_CONFIG.costs.starvationRate; // 0.02 (wait, I lowered it to 0.005 in code but config says 0.02? No, I edited MetabolismSystem to use config value or 0.005)
        
        MetabolismSystem.update(state, DEFAULT_CONFIG);

        expect(settlement.population).toBeLessThan(initialPop);
        expect(settlement.population).toBeCloseTo(initialPop - (initialPop * starvationRate), 5);
    });

    it('should generate tax income based on population', () => {
        const initialGold = settlement.stockpile.Gold;
        MetabolismSystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Gold).toBeGreaterThan(initialGold);
    });

    it('should remove settlement if population reaches zero', () => {
        settlement.population = 0.1;
        settlement.stockpile.Food = 0;
        
        MetabolismSystem.update(state, DEFAULT_CONFIG);
        
        expect(state.settlements['test-settlement']).toBeUndefined();
        expect(state.map['0,0'].ownerId).toBeNull();
    });

    it('should respect soft population caps based on tier', () => {
        // Tier 0 cap is 200.
        settlement.population = 200;
        settlement.stockpile.Food = 1000;
        settlement.controlledHexIds = Array(10).fill('0,0'); // Ensure plenty of jobs
        
        MetabolismSystem.update(state, DEFAULT_CONFIG);
        
        const growthNormal = 200 * DEFAULT_CONFIG.costs.growthRate;
        const actualGrowth = settlement.population - 200;
        
        // Should be 10% of normal growth
        expect(actualGrowth).toBeCloseTo(growthNormal * 0.1, 5);
    });
});
