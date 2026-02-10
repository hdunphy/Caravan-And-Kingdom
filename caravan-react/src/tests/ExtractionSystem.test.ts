import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractionSystem } from '../simulation/systems/ExtractionSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('ExtractionSystem', () => {
    let state: WorldState;
    let settlement: Settlement;

    beforeEach(() => {
        settlement = {
            id: 'test-settlement',
            name: 'Test City',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 100,
            stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 0,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['0,0', '1,0'],
            buildings: []
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'player_1', resources: {} }
            },
            settlements: { 'test-settlement': settlement },
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: '#0000ff' }
            },
            width: 2,
            height: 1
        };
    });

    it('should extract resources from center hex directly to stockpile', () => {
        const yieldPlains = DEFAULT_CONFIG.yields.Plains.Food || 0;
        ExtractionSystem.update(state, DEFAULT_CONFIG);
        expect(settlement.stockpile.Food).toBe(yieldPlains);
    });

    it('should accumulate resources on remote hexes', () => {
        const yieldForest = DEFAULT_CONFIG.yields.Forest.Timber || 0;
        ExtractionSystem.update(state, DEFAULT_CONFIG);
        expect(state.map['1,0'].resources?.Timber).toBe(yieldForest);
    });

    it('should apply tool bonus and occasionally break tools', () => {
        settlement.stockpile.Tools = 100;
        const toolBonus = DEFAULT_CONFIG.costs.toolBonus; // 1.5
        const yieldPlains = DEFAULT_CONFIG.yields.Plains.Food || 0;
        
        ExtractionSystem.update(state, DEFAULT_CONFIG);
        
        expect(settlement.stockpile.Food).toBe(yieldPlains * toolBonus);
        expect(settlement.stockpile.Tools).toBeLessThanOrEqual(100);
    });

    it('should apply building yield bonuses', () => {
        settlement.buildings = [{
            id: 'b1',
            type: 'GathererHut',
            hexId: '0,0',
            integrity: 100,
            level: 1
        }];
        
        const yieldPlains = DEFAULT_CONFIG.yields.Plains.Food || 0;
        const effectValue = DEFAULT_CONFIG.buildings.GathererHut.effects?.[0].value || 0; // 0.2
        
        ExtractionSystem.update(state, DEFAULT_CONFIG);
        
        expect(settlement.stockpile.Food).toBeCloseTo(yieldPlains * (1.0 + effectValue), 5);
    });

    it('should generate gold for faction from water tiles', () => {
        state.map['1,0'].terrain = 'Water';
        const yieldWaterGold = DEFAULT_CONFIG.yields.Water.Gold || 0;
        
        ExtractionSystem.update(state, DEFAULT_CONFIG);
        
        expect(state.factions['player_1'].gold).toBe(yieldWaterGold);
    });
});
