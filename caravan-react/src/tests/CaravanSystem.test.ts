import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';
import { WorldState, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { HexUtils } from '../utils/HexUtils';

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
            buildings: []
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
            buildings: []
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
        s2.stockpile.Timber = 0;
        s1.stockpile.Timber = 500; // s1 has surplus
        
        CaravanSystem.processTrade(state, DEFAULT_CONFIG);
        
        // Should dispatch from s2 (buyer) to s1 (seller)?
        // processTrade logic: source (buyer) identifies deficit, finds target (seller) with surplus.
        // source must have Gold > 1.
        const tradeAgent = Object.values(state.agents).find(a => a.type === 'Caravan' && a.mission === 'TRADE');
        expect(tradeAgent).toBeDefined();
        expect(tradeAgent?.homeId).toBe('s2');
        expect((tradeAgent as any).targetSettlementId).toBe('s1');
    });

    it('should handle outbound logistics missions (loading resources)', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Caravan');
        if (!agent) throw new Error('Spawn failed');
        agent.mission = 'LOGISTICS';
        agent.tradeState = 'OUTBOUND';
        agent.homeId = 's1';
        agent.position = { q: 1, r: 0, s: -1 }; // Already at target
        agent.path = []; // Arrived
        
        state.map['1,0'].resources = { Timber: 50 };
        
        // 1st update: Trigger LOADING
        CaravanSystem.update(state, DEFAULT_CONFIG);
        expect(agent.activity).toBe('LOADING');
        expect(agent.waitTicks).toBeGreaterThan(0);
        
        // Fast forward wait
        agent.waitTicks = 1;
        CaravanSystem.update(state, DEFAULT_CONFIG);
        
        // After loading, should move back home
        expect(agent.cargo.Timber).toBe(50);
        expect(state.map['1,0'].resources?.Timber).toBe(0);
        expect(agent.tradeState).toBe('INBOUND');
        expect(agent.activity).toBe('MOVING');
    });

    it('should handle settler mission and found a new settlement', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Settler');
        if (!agent) throw new Error('Spawn failed');
        agent.position = { q: 1, r: 0, s: -1 }; // Already at target
        agent.path = []; // Arrived
        agent.cargo = { Food: 100, Timber: 50 };
        
        // Remove map owner to allow founding
        state.map['1,0'].ownerId = null;
        
        CaravanSystem.update(state, DEFAULT_CONFIG);
        
        const newSettlement = Object.values(state.settlements).find(s => s.hexId === '1,0');
        expect(newSettlement).toBeDefined();
        expect(newSettlement?.stockpile.Food).toBe(100);
        expect(state.map['1,0'].ownerId).toBe('player_1');
        // Settler agent should be removed
        expect(state.agents[agent.id]).toBeUndefined();
    });

    it('should repair idle caravans at home', () => {
        const agent = CaravanSystem.spawn(state, '0,0', '0,0', 'Caravan');
        if (!agent) throw new Error('Spawn failed');
        agent.status = 'IDLE';
        agent.homeId = 's1';
        agent.integrity = 50;
        s1.stockpile.Timber = 100;
        
        CaravanSystem.update(state, DEFAULT_CONFIG);
        
        expect(agent.integrity).toBeGreaterThan(50);
        expect(s1.stockpile.Timber).toBeLessThan(100);
    });
});
