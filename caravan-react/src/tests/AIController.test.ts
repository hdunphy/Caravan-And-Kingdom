import { describe, it, expect, beforeEach } from 'vitest';
import { AIController } from '../simulation/ai/AIController';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('AIController', () => {
    let state: WorldState;
    let controller: AIController;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'p1',
            population: 100,
            stockpile: { Food: 1000, Timber: 1000, Stone: 1000, Ore: 1000, Tools: 0, Gold: 100 },
            integrity: 100,
            tier: 1,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            buildings: []
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

        controller = new AIController();
    });

    it('should update goals and execute actions on interval', () => {
        // Mock a build action by setting goal to SURVIVE and making sure food is low
        settlement.stockpile.Food = 0;

        // Tick is 0, update should run (first time or based on lastUpdateTick)
        state.tick = 0;
        controller.update(state, DEFAULT_CONFIG);

        expect(settlement.currentGoal).toBe('SURVIVE');
        // ConstructionStrategy should have triggered a GathererHut build
        expect(settlement.buildings.length).toBe(1);
        expect(settlement.buildings[0].type).toBe('GathererHut');
    });

    it('should throttle updates based on checkInterval', () => {
        const interval = DEFAULT_CONFIG.ai.checkInterval; // 10

        controller.update(state, DEFAULT_CONFIG); // Tick 0
        // const firstTickBuildings = settlement.buildings.length;

        state.tick = 1;
        controller.update(state, DEFAULT_CONFIG);
        // Should not have updated again
        expect(state.tick - 0).toBeLessThan(interval);
    });
    it('should execute both BUILD and DISPATCH_VILLAGER in the same tick', () => {
        // Setup: Low Food (Trigger Build & Gather), High Timber (Can Build), Available Villager
        settlement.stockpile.Food = 0;
        settlement.stockpile.Timber = 1000;
        settlement.availableVillagers = 1;

        // Add a resource nearby for the villager to gather
        state.map['1,0'] = {
            id: '1,0',
            coordinate: { q: 1, r: 0, s: -1 },
            terrain: 'Plains',
            ownerId: 'p1',
            resources: { Food: 100 }
        };
        settlement.controlledHexIds.push('1,0');

        controller.update(state, DEFAULT_CONFIG);

        // Assert Build
        expect(settlement.buildings.length).toBe(1);
        expect(settlement.buildings[0].type).toBe('GathererHut');

        // Assert Dispatch
        const villagers = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(villagers.length).toBe(1);
        expect(settlement.availableVillagers).toBe(0);
    });
});
