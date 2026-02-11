import { describe, it, expect, beforeEach } from 'vitest';
import { UpgradeSystem } from '../simulation/systems/UpgradeSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { HexUtils } from '../utils/HexUtils';

describe('UpgradeSystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 'test-settlement',
            name: 'Test City',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 10,
            stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 0,
            jobCap: 100,
            workingPop: 10,
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            buildings: [],
            popHistory: []
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
            width: 10,
            height: 10
        };

        // Add enough plains neighbors
        const neighbors = HexUtils.getSpiral({ q: 0, r: 0, s: 0 }, 3); // Range 3 for City upgrade
        neighbors.forEach(n => {
            const id = HexUtils.getID(n);
            state.map[id] = { id, coordinate: n, terrain: 'Plains', ownerId: 'player_1', resources: {} };
        });
    });

    it('should not upgrade if requirements are not met', () => {
        const canUpgrade = UpgradeSystem.tryUpgrade(state, settlement, DEFAULT_CONFIG);
        expect(canUpgrade).toBe(false);
        expect(settlement.tier).toBe(0);
    });

    it('should upgrade Village to Town when requirements are met', () => {
        const config = DEFAULT_CONFIG.upgrades.villageToTown;
        settlement.population = config.population;
        settlement.stockpile.Timber = config.costTimber;
        settlement.stockpile.Stone = config.costStone;

        const result = UpgradeSystem.tryUpgrade(state, settlement, DEFAULT_CONFIG);

        expect(result).toBe(true);
        expect(settlement.tier).toBe(1);
        expect(settlement.stockpile.Timber).toBe(0);
        expect(settlement.controlledHexIds.length).toBeGreaterThan(7); // Expanded to range 2
    });

    it('should upgrade Town to City when requirements are met', () => {
        settlement.tier = 1;
        const config = DEFAULT_CONFIG.upgrades.townToCity;
        settlement.population = config.population;
        settlement.stockpile.Timber = config.costTimber;
        settlement.stockpile.Stone = config.costStone;
        settlement.stockpile.Ore = config.costOre;

        const result = UpgradeSystem.tryUpgrade(state, settlement, DEFAULT_CONFIG);

        expect(result).toBe(true);
        expect(settlement.tier).toBe(2);
        expect(settlement.controlledHexIds.length).toBeGreaterThan(19); // Expanded to range 3
    });
});
