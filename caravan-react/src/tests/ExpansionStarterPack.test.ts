
import { describe, it, expect, beforeEach } from 'vitest';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';
import { WorldState, Settlement, Faction, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Expansion Starter Pack', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 0,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', ownerId: null, resources: {} }
            },
            settlements: {},
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: '#0000ff' } as Faction
            },
            width: 10,
            height: 10
        } as any;
    });

    it('should add starter pack resources to new settlement stockpile', () => {
        // Config with specific Starter Pack
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        config.ai.expansionStarterPack = {
            Food: 500,
            Timber: 200,
            Stone: 50,
            Gold: 100
        };

        // Spawn Settler at destination (skip movement)
        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Settler', config);
        if (!agent) throw new Error('Spawn failed');

        agent.position = { q: 1, r: 0, s: -1 }; // At target
        agent.path = []; // Arrived
        agent.cargo = { Food: 100, Timber: 50 }; // Initial Cargo

        // Update to trigger founding
        CaravanSystem.update(state, config);

        // Find new settlement
        const newSettlement = Object.values(state.settlements).find(s => s.hexId === '1,0');
        expect(newSettlement).toBeDefined();

        if (newSettlement) {
            // Food: 100 (Cargo) + 500 (Starter) = 600
            expect(newSettlement.stockpile.Food).toBe(600);

            // Timber: 50 (Cargo) + 200 (Starter) = 250
            expect(newSettlement.stockpile.Timber).toBe(250);

            // Stone: 0 (Cargo) + 50 (Starter) = 50
            expect(newSettlement.stockpile.Stone).toBe(50);

            // Gold: 0 (Cargo) + 100 (Starter) = 100
            expect(newSettlement.stockpile.Gold).toBe(100);
        }
    });

    it('should handle undefined starter pack gracefully', () => {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        delete config.ai.expansionStarterPack;

        const agent = CaravanSystem.spawn(state, '0,0', '1,0', 'Settler', config);
        if (!agent) throw new Error('Spawn failed');

        agent.position = { q: 1, r: 0, s: -1 };
        agent.path = [];
        agent.cargo = { Food: 100 };

        CaravanSystem.update(state, config);

        const newSettlement = Object.values(state.settlements).find(s => s.hexId === '1,0');
        expect(newSettlement).toBeDefined();
        if (newSettlement) {
            expect(newSettlement.stockpile.Food).toBe(100);
            expect(newSettlement.stockpile.Timber).toBe(0);
        }
    });
});
