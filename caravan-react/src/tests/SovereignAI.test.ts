import { describe, it, expect, beforeEach } from 'vitest';
import { SovereignAI } from '../simulation/ai/SovereignAI';
import { WorldState, Faction, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Sovereign AI (Stance Logic)', () => {
    let state: WorldState;
    let faction: Faction;
    let config = { ...DEFAULT_CONFIG };

    beforeEach(() => {
        faction = { id: 'f1', name: 'Faction 1', color: 'red', type: 'AI' };
        state = {
            map: {},
            width: 10,
            height: 10,
            factions: { f1: faction },
            settlements: {},
            agents: {},
            tick: 100
        };

        // Reset Config defaults for testing
        config.ai.settlementCap = 5;
        config.ai.sovereign = {
            checkInterval: 100,
            foodSurplusRatio: 0.8,
            desperationFoodRatio: 0.5,
            scarcityThresholds: {
                Stone: 0.1, // 10% of land must be Stone
                Ore: 0.1,
                Timber: 0.1,
            },
            urgencyBoosts: {
                Stone: 0.5,
                Timber: 0.5,
                Ore: 0.3,
                Gold: 0.1,
            },
            capPenalty: 0.1,
            capOverrideMultiplier: 1.5,
            stanceShiftThreshold: 0.3
        };
        config.ai.thresholds.surviveTicks = 10;
        config.costs.baseConsume = 1; // 1 food per pop per tick for easy math
        hexCounter = 0;
    });

    const createSettlement = (id: string, pop: number, food: number): Settlement => {
        return {
            id,
            name: id,
            hexId: '0,0',
            ownerId: 'f1',
            population: pop,
            stockpile: { Food: food, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 1,
            role: 'GENERAL',
            jobCap: 10,
            workingPop: 0,
            availableVillagers: 0,
            controlledHexIds: [],
            popHistory: [],
            buildings: []
        };
    };

    let hexCounter = 0;
    const mockLand = (count: number, type: 'Plains' | 'Hills' | 'Forest' | 'Mountains', settlementId?: string) => {
        for (let i = 0; i < count; i++) {
            const id = `${hexCounter},0`;
            state.map[id] = {
                id: id,
                coordinate: { q: hexCounter, r: 0, s: -hexCounter },
                terrain: type,
                ownerId: 'f1',
                resources: {}
            };

            if (settlementId && state.settlements[settlementId]) {
                state.settlements[settlementId].controlledHexIds.push(id);
            }

            hexCounter++;
        }
    };

    it('should initialize blackboard if missing', () => {
        SovereignAI.evaluate(faction, state, config);
        expect(faction.blackboard).toBeDefined();
        expect(faction.blackboard?.stances.exploit).toBe(1.0); // Default
    });

    it('should pivot to EXPAND when food is abundant and room exists', () => {
        // 1 Settlement, Cap is 5
        // SafeLevel = 10 pop * 1 consume * 10 ticks = 100 Food
        // We give 200 Food (200% surplus, > 80% req)
        const s1 = createSettlement('s1', 10, 200);
        state.settlements['s1'] = s1;

        // Give some land so we don't trigger scarcity by accident? 
        // Actually auditing resources is separate. 
        // Let's give 10 hexes of mixed types to satisfy thresholds
        mockLand(5, 'Hills', 's1'); // Stone/Ore
        mockLand(5, 'Forest', 's1'); // Timber

        SovereignAI.evaluate(faction, state, config);

        expect(faction.blackboard?.stances.expand).toBe(1.0);
        expect(faction.blackboard?.stances.exploit).toBe(0.0);
    });

    it('should pivot to EXPLOIT if food is low', () => {
        // SafeLevel = 100. We give 50 (50% surplus).
        // Requirement is 80%.
        const s1 = createSettlement('s1', 10, 50);
        state.settlements['s1'] = s1;

        mockLand(10, 'Hills', 's1');

        SovereignAI.evaluate(faction, state, config);

        expect(faction.blackboard?.stances.expand).toBe(0.0);
        expect(faction.blackboard?.stances.exploit).toBe(1.0);
    });

    it('should detect Critical Shortages', () => {
        const s1 = createSettlement('s1', 10, 200);
        state.settlements['s1'] = s1;

        // 10 Hexes of Water (Food, Gold, but NO Timber/Stone/Ore)
        // Note: mockLand types need to be expanded or mapped.
        // Helper only accepts 'Plains' | 'Hills' | 'Forest' | 'Mountains'
        // Let's use Mountains (Ore, Stone, No Timber)
        mockLand(10, 'Mountains', 's1');

        SovereignAI.evaluate(faction, state, config);

        const shortages = faction.blackboard?.criticalShortages;
        // Mountains have Stone/Ore, but no Timber or Food (if food was thresholded)
        expect(shortages).toContain('Timber');
    });

    it('should OVERRULE for EXPAND if Critical Shortage exists and food is decent', () => {
        // We need 50% surplus ratio.
        // S1: Safe (200 Food > 100 Needs)
        // S2: Unsafe (50 Food < 100 Needs)
        // Ratio = 0.5. Matches desperation req.
        const s1 = createSettlement('s1', 10, 200);
        const s2 = createSettlement('s2', 10, 50);
        state.settlements['s1'] = s1;
        state.settlements['s2'] = s2;

        // Critical Shortage: No Stone
        mockLand(10, 'Plains', 's1');

        SovereignAI.evaluate(faction, state, config);

        // Should expand despite low-ish food because we are desperate for Stone
        // Should expand despite low-ish food because we are desperate for Stone
        // Urgency score results in 0.8 (High Expand)
        expect(faction.blackboard?.stances.expand).toBeGreaterThan(0.7);
        expect(faction.blackboard?.criticalShortages).toContain('Stone');
    });

    it('should NOT overrule if food is dangerously low', () => {
        // Food is 40 (40% surplus).
        // Desperation req is 50%.
        const s1 = createSettlement('s1', 10, 40);
        state.settlements['s1'] = s1;

        mockLand(10, 'Plains', 's1'); // Shortage

        SovereignAI.evaluate(faction, state, config);

        // Too hungry to expand even though we need Stone
        expect(faction.blackboard?.stances.expand).toBe(0.0);
        expect(faction.blackboard?.stances.exploit).toBe(1.0);
    });

    it('should NOT expand if at Settlement Cap (unless desperate)', () => {
        config.ai.settlementCap = 1;

        const s1 = createSettlement('s1', 10, 500); // 500% food
        state.settlements['s1'] = s1;
        mockLand(5, 'Hills', 's1'); // Stone/Ore
        mockLand(5, 'Forest', 's1'); // Timber - Ensure no shortages trigger overrule

        SovereignAI.evaluate(faction, state, config);

        expect(faction.blackboard?.stances.expand).toBeLessThan(0.2); // Capped (0.1 penalty)
    });

    it('should IGNORE CAP if desperate for resources', () => {
        config.ai.settlementCap = 1;

        const s1 = createSettlement('s1', 10, 500);
        state.settlements['s1'] = s1;
        mockLand(10, 'Plains', 's1'); // Shortage of Stone

        SovereignAI.evaluate(faction, state, config);

        expect(faction.blackboard?.stances.expand).toBe(0.15); // Cap ignored but penalty still heavy (0.1 * 1.5)
    });
});
