import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Settlement, Faction, Resources, HexCell, AgentEntity } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { TradeStrategy } from '../simulation/ai/TradeStrategy';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';

describe('Trade Reporting & Overrides', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell,
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as HexCell
            },
            settlements: {},
            agents: {},
            factions: {
                'p1': { id: 'p1', name: 'Player', color: 'blue', stats: { totalTrades: 0, tradeResources: {}, settlersSpawned: 0, settlementsFounded: 0 } } as Faction
            },
            width: 10,
            height: 10
        };
    });

    it('should increment faction trade stats when a trade is completed', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 50, tier: 1,
            stockpile: { Food: 100, Gold: 5000, Timber: 100, Stone: 0, Ore: 0, Tools: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 2, jobCap: 20, workingPop: 10,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        const s2: Settlement = {
            id: 's2', ownerId: 'p1', hexId: '1,0', population: 50, tier: 1,
            stockpile: { Food: 5000, Gold: 0, Timber: 100, Stone: 0, Ore: 0, Tools: 0 },
            controlledHexIds: ['1,0'], availableVillagers: 2, jobCap: 20, workingPop: 10,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;
        state.settlements['s2'] = s2;

        const config = { ...DEFAULT_CONFIG };
        config.costs.logistics.tradeRoiThreshold = 10;

        // 1. Dispatch Trade
        const context = { targetId: 's2', resource: 'Food', gold: 100, value: 100 };
        const caravan = CaravanSystem.dispatch(state, s1, '1,0', 'TRADE', config, context) as any;

        // 2. Teleport to target
        caravan.position = { q: 1, r: 0, s: -1 };
        caravan.path = [];
        
        // 3. Update (Buy phase)
        CaravanSystem.update(state, config); // Start Loading
        for(let i=0; i<config.costs.trade.loadingTime; i++) CaravanSystem.update(state, config);
        CaravanSystem.update(state, config); // Finish Loading, apply stats

        expect(state.factions['p1'].stats?.totalTrades).toBe(1);
        expect(state.factions['p1'].stats?.tradeResources['Food']).toBe(1);
    });

    it('should trigger trade due to Starvation Override even if ROI is too low', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 10, Gold: 5000, Timber: 100, Stone: 0, Ore: 0, Tools: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 2, jobCap: 20, workingPop: 10,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        const s2: Settlement = {
            id: 's2', ownerId: 'p1', hexId: '1,0', population: 50, tier: 1,
            stockpile: { Food: 5000, Gold: 0, Timber: 100, Stone: 0, Ore: 0, Tools: 0 },
            controlledHexIds: ['1,0'], availableVillagers: 2, jobCap: 20, workingPop: 10,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;
        state.settlements['s2'] = s2;

        const config = { ...DEFAULT_CONFIG };
        // Set ROI so high that trade is normally impossible
        config.costs.logistics.tradeRoiThreshold = 1000;

        // ROI Check: Estimated travel cost (dist 1 * 2 * 2 = 4). minVal = 4 * 1000 = 4000.
        // Trade Value is capped at capacity 50 or 100.
        // Normally this would fail.

        const route = TradeStrategy.findBestSeller(s1, 'Food', state, config);

        // EXPECTATION: Starvation Override kicks in because Food < 50 ticks (100 * 0.1 * 50 = 500)
        expect(route).not.toBeNull();
        expect(route?.resource).toBe('Food');
    });
});
