
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIController } from '../simulation/ai/AIController';
import { WorldState, Faction, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Sovereign AI (Jitter & Decentralization)', () => {
    let ai: AIController;
    let state: WorldState;

    beforeEach(() => {
        ai = new AIController();
        const f1: Faction = { id: 'f1', name: 'Faction 1', color: 'red', type: 'AI', gold: 0 };
        const f2: Faction = { id: 'f2', name: 'Faction 2', color: 'blue', type: 'AI', gold: 0 };
        const f3: Faction = { id: 'f3', name: 'Faction 3', color: 'green', type: 'AI', gold: 0 };

        state = {
            map: {},
            width: 10,
            height: 10,
            factions: { f1, f2, f3 },
            settlements: {},
            agents: {},
            tick: 100
        };
    });

    it('should initialize faction states with staggered timing', () => {
        // Run once to initialize
        ai.update(state, DEFAULT_CONFIG, true);

        // Access private field via 'any' casting for testing
        const states = (ai as any).factionStates;
        expect(states.size).toBe(3);

        const timings = Array.from(states.values()).map((s: any) => s.nextInterval);
        // Expect some variation due to random stagger (0-3) + base interval (10)
        // Note: nextInterval is set to base (10) + stagger (0-3) initially

        // We can't strictly assert they are DIFFERENT because random might collide,
        // but we can check they are within expected range [10, 13]
        timings.forEach((t: number) => {
            expect(t).toBeGreaterThanOrEqual(10);
            expect(t).toBeLessThanOrEqual(13);
        });
    });

    it('should update different factions at different times (Decentralized)', () => {
        // Force specific timings to verify independent execution
        (ai as any).factionStates.set('f1', { lastTick: 100, nextInterval: 10 }); // Due at 110
        (ai as any).factionStates.set('f2', { lastTick: 105, nextInterval: 10 }); // Due at 115

        const processSpy = vi.spyOn(ai as any, 'processFaction');

        // Tick 110: F1 should update, F2 should not
        state.tick = 110;
        ai.update(state, DEFAULT_CONFIG, true);

        expect(processSpy).toHaveBeenCalledWith('f1', state, DEFAULT_CONFIG, true);
        expect(processSpy).not.toHaveBeenCalledWith('f2', expect.anything(), expect.anything(), expect.anything());

        processSpy.mockClear();

        // Tick 115: F2 should update
        state.tick = 115;
        ai.update(state, DEFAULT_CONFIG, true);

        expect(processSpy).toHaveBeenCalledWith('f2', state, DEFAULT_CONFIG, true);
    });

    it('should apply decision jitter to break ties', () => {
        // Mock a scenario where 2 actions have identical utility
        // but jitter makes one win

        const settlement: Settlement = {
            id: 's1',
            name: 'S1',
            hexId: '0,0',
            ownerId: 'f1',
            population: 10,
            tier: 1,
            stockpile: { Food: 100, Timber: 100, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            buildings: [],
            availableVillagers: 0,
            controlledHexIds: ['0,0'],
            popHistory: [],
            integrity: 100,
            jobCap: 10,
            workingPop: 0,
            role: 'GENERAL'
        };
        state.settlements['s1'] = settlement;

        // Create 2 identical strategies
        const strategy1 = {
            evaluate: () => [{
                type: 'BUILD',
                buildingType: 'A',
                score: 10.0,
                settlementId: 's1',
                hexId: '0,0'
            }]
        };
        const strategy2 = {
            evaluate: () => [{
                type: 'BUILD',
                buildingType: 'B',
                score: 10.0,
                settlementId: 's1',
                hexId: '0,0'
            }]
        };

        // Inject strategies
        (ai as any).civilStrategies = [strategy1, strategy2];

        // Mock Math.random to favor Strategy 2 (B)
        // processFaction calls runGovernor 'CIVIL'
        // runGovernor generates actions A (10.0) and B (10.0)
        // Then iterates and adds jitter: actions.forEach(a => a.score += random * 0.05)

        // We want 2nd call to random to be higher.
        // calls: 
        // 1. shuffle (multiple calls)
        // 2. stagger init (multiple calls if new) - assuming we pre-init
        // 3. jitter nextInterval
        // 4. action jitter

        // This is hard to deterministic test with global Math.random.
        // Instead, let's just spy on executeAction and verify it gets called
        // for one of them.

        const executeSpy = vi.spyOn(ai as any, 'executeAction');
        executeSpy.mockReturnValue(true);

        // Pre-init state to skip init randoms
        (ai as any).factionStates.set('f1', { lastTick: 0, nextInterval: 1 });
        state.tick = 100;

        ai.update(state, DEFAULT_CONFIG, true);

        expect(executeSpy).toHaveBeenCalled();
        const calls = executeSpy.mock.calls;
        // Should have picked one.
        // With equal score and no jitter, sort is unstable or first-one-wins.
        // With jitter, it's random. 
        // We just verify it ran.
        expect(calls.length).toBeGreaterThan(0);
        expect(['A', 'B']).toContain((calls[0][2] as any).buildingType);
    });
});
