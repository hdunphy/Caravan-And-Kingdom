import { describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceSystem } from '../simulation/systems/MaintenanceSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('MaintenanceSystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'p1',
            population: 100,
            stockpile: { Food: 1000, Timber: 100, Stone: 100, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 1,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            buildings: [],
            popHistory: []
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

    it('should maintain settlement integrity when resources exist', () => {
        settlement.integrity = 90;
        MaintenanceSystem.update(state, DEFAULT_CONFIG);
        expect(settlement.integrity).toBe(91);
        expect(settlement.stockpile.Timber).toBeLessThan(100);
    });

    it('should decay settlement integrity when resources are missing', () => {
        settlement.stockpile.Timber = 0;
        settlement.stockpile.Stone = 0;
        MaintenanceSystem.update(state, DEFAULT_CONFIG);
        expect(settlement.integrity).toBeLessThan(100);
    });

    it('should handle building maintenance', () => {
        settlement.buildings = [{
            id: 'b1',
            type: 'GathererHut',
            hexId: '0,0',
            integrity: 90,
            level: 1
        }];

        MaintenanceSystem.update(state, DEFAULT_CONFIG);

        // Decay logic: integrity = max(0, integrity - decay)
        // Repair logic: if integrity < 100, try repair.
        // It happens in the same tick.
        // Decay is 2. Repair is 10.
        // 90 - 2 + 10 = 98.
        expect(settlement.buildings[0].integrity).toBe(98);
        expect(settlement.stockpile.Timber).toBeLessThan(100);
    });
});
