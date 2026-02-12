import { describe, it, expect, beforeEach } from 'vitest';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
// import { HexUtils } from '../utils/HexUtils';

describe('CaravanSystem', () => {
    let state: WorldState;
    let s1: Settlement;
    let s2: Settlement;

    beforeEach(() => {
        s1 = {
            id: 's1',
            name: 'Settlement 1',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 100,
            stockpile: { Food: 1000, Timber: 1000, Stone: 0, Ore: 0, Tools: 0, Gold: 100 },
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

        s2 = {
            id: 's2',
            name: 'Settlement 2',
            hexId: '2,0',
            ownerId: 'player_1',
            population: 100,
            stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 100 },
            integrity: 100,
            tier: 0,
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 0,
            controlledHexIds: ['2,0'],
            buildings: [],
            popHistory: [],
            role: 'GENERAL'
        };

        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: 'player_1', resources: {} },
                '2,0': { id: '2,0', coordinate: { q: 2, r: 0, s: -2 }, terrain: 'Plains', ownerId: 'player_1', resources: {} }
            },
            settlements: { 's1': s1, 's2': s2 },
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: '#0000ff' }
            },
            width: 3,
            height: 1
        };
    });

    it('should spawn a caravan with correct properties', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '2,0', 'Caravan');
        expect(agent).not.toBeNull();
        expect(agent?.type).toBe('Caravan');
        expect(agent?.ownerId).toBe('player_1');
        expect(agent?.path?.length).toBeGreaterThan(0);
        expect(Object.keys(state.agents).length).toBe(1);
    });

    it('should identify deficits and dispatch trade caravans', () => {
        // s2 needs Timber (goal default is TOOLS, which checks Timber < 100)
        s2.currentGoal = 'TOOLS';
        // Needs enough to build caravan (50) but less than goal (100)
        s2.stockpile.Timber = 60;

        // s1 needs enough Timber to pass the target's surplus check:
        // Surplus threshold for non-food is 100 (hardcoded in CaravanSystem.processTrade currently, TODO move to config)
        s1.stockpile.Timber = 150;

        const TEST_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        TEST_CONFIG.costs.logistics.tradeRoiThreshold = 20;

        CaravanSystem.processTrade(state, TEST_CONFIG);

        const tradeAgent = Object.values(state.agents).find(a => a.type === 'Caravan' && a.mission === 'TRADE');
        expect(tradeAgent).toBeDefined();
        expect((tradeAgent as any)?.homeId).toBe('s2');
        expect((tradeAgent as any).targetSettlementId).toBe('s1');
    });

    it('should handle outbound logistics missions (loading resources)', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Caravan');
        if (!agent) throw new Error('Spawn failed');
        (agent as any).mission = 'LOGISTICS';
        (agent as any).tradeState = 'OUTBOUND';
        (agent as any).homeId = 's1';
        agent.position = { q: 1, r: 0, s: -1 }; // Already at target
        agent.path = []; // Arrived

        const freightAmount = DEFAULT_CONFIG.costs.logistics.freightThreshold;
        state.map['1,0'].resources = { Timber: freightAmount };

        // 1st update: Trigger LOADING
        CaravanSystem.update(state, DEFAULT_CONFIG);
        expect(agent.activity).toBe('LOADING');

        // Advance ticks to finish loading
        agent.waitTicks = 0; // Force finish loading for test speed

        // 2nd update: Finish loading and start returning
        CaravanSystem.update(state, DEFAULT_CONFIG);

        // After loading, should move back home
        expect(agent.cargo.Timber || 0).toBe(freightAmount);
        expect(state.map['1,0'].resources?.Timber).toBe(0);
        expect((agent as any).tradeState).toBe('INBOUND');
    });

    it('should handle settler mission and found a new settlement', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Settler');
        if (!agent) throw new Error('Spawn failed');
        agent.position = { q: 1, r: 0, s: -1 }; // Already at target
        agent.path = []; // Arrived

        const starterFood = DEFAULT_CONFIG.ai.expansionStarterPack.Food;
        agent.cargo = { Food: starterFood };

        // Remove map owner to allow founding
        state.map['1,0'].ownerId = null;

        CaravanSystem.update(state, DEFAULT_CONFIG);

        const newSettlement = Object.values(state.settlements).find(s => s.hexId === '1,0');
        expect(newSettlement).toBeDefined();
        expect(newSettlement?.stockpile.Food).toBe(starterFood);
    });

    it('should repair idle caravans at home', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '0,0', 'Caravan');
        if (!agent) throw new Error('Spawn failed');
        agent.status = 'IDLE';
        (agent as any).homeId = 's1';
        agent.integrity = 50;

        const repairCost = DEFAULT_CONFIG.costs.logistics.caravanRepairCost;
        s1.stockpile.Timber = repairCost * 2;

        CaravanSystem.update(state, DEFAULT_CONFIG);

        expect(agent.integrity).toBeGreaterThan(50);
        expect(s1.stockpile.Timber).toBe(repairCost);
    });
});
