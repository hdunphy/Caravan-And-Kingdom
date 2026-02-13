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
            role: 'GENERAL',
            aiState: { surviveMode: false, savingFor: null, focusResources: [] }
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

    it('should produce tools when below target ratio and materials exist with surplus', () => {
        // Target ratio 0.2, pop 100 => 20 tools
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(1);
        expect(settlement.stockpile.Timber).toBeLessThan(1000);
        expect(settlement.stockpile.Ore).toBeLessThan(1000);
    });

    it('should respect surplus threshold even with low tools', () => {
        settlement.stockpile.Timber = 50; // threshold is 50, cost is usually added to this
        // In IndustrySystem: const SURPLUS_THRESHOLD = config.industry.surplusThreshold || 50; 
        // const canProduce = settlement.stockpile.Timber > (TIMBER_COST + SURPLUS_THRESHOLD)
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(0);
    });

    it('should stop producing if survival mode is on and resources are low (indirectly via surplus)', () => {
        settlement.aiState!.surviveMode = true;
        settlement.stockpile.Timber = 60; // Just above threshold maybe? No, Timber cost is 100 in some configs?
        // Default config: costTimber: 5, surplusThreshold: 50 => needs 55+
        settlement.stockpile.Timber = 54;
        IndustrySystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Tools).toBe(0);
    });
});
