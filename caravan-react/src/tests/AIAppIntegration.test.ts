import { describe, it, expect } from 'vitest';
import { AIController } from '../simulation/ai/AIController';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { WorldState } from '../types/WorldTypes';

describe('AI App Integration', () => {
    it('should dispatch multiple villagers in one tick (Multi-Action Execution)', () => {
        // Setup State
        const state: WorldState = {
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                // Neighbors for 0,0
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '1,-1': { id: '1,-1', coordinate: { q: 1, r: -1, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '0,-1': { id: '0,-1', coordinate: { q: 0, r: -1, s: 1 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '-1,0': { id: '-1,0', coordinate: { q: -1, r: 0, s: 1 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '-1,1': { id: '-1,1', coordinate: { q: -1, r: 1, s: 0 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
                '0,1': { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Plains', resources: { Food: 100 }, ownerId: 'player_1' },
            },
            settlements: {
                's1': {
                    id: 's1',
                    name: 'Capital',
                    ownerId: 'player_1',
                    hexId: '0,0',
                    population: 10,
                    availableVillagers: 5, // 5 Idle Villagers
                    controlledHexIds: ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'], // Matches keys above
                    stockpile: { Food: 10, Timber: 0, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                    buildings: [],
                    tier: 0,
                    integrity: 100,
                    jobCap: 10,
                    workingPop: 0,
                    aiState: { surviveMode: true, savingFor: null, focusResources: [] },
                    currentGoal: 'SURVIVE'
                }
            },
            agents: {},
            factions: {
                'player_1': { id: 'player_1', name: 'Player', color: 'blue', gold: 0, type: 'AI' }
            },
            tick: 100,
            width: 10,
            height: 10
        };

        const controller = new AIController();
        controller.update(state, DEFAULT_CONFIG);

        // Verify result: Should have spawned 5 villagers
        const villagers = Object.values(state.agents).filter(a => a.type === 'Villager');
        expect(villagers.length).toBe(5);
        expect(state.settlements['s1'].availableVillagers).toBe(0);
    });
});
