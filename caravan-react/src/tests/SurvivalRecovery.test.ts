
import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { AIController } from '../simulation/ai/AIController';
import { Settlement, Faction, WorldState, ResourceType } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Survival Recovery & prioritization', () => {
    let settlement: Settlement;
    let faction: Faction;
    let state: WorldState;

    beforeEach(() => {
        settlement = {
            id: 's1',
            ownerId: 'f1',
            hexId: 'h1',
            population: 50, // Decent pop
            tier: 0, // Village
            stockpile: {
                Food: 0, // STARVING
                Timber: 500,
                Stone: 500,
                Ore: 0,
                Tools: 0, // NO TOOLS (Triggers Smithy desire)
                Gold: 100
            },
            buildings: [],
            controlledHexIds: ['h1'],
            workingPop: 0,
            availableVillagers: 2,
            aiState: {
                surviveMode: true, // Force Survive Mode
                lastCheckTick: 0
            }
        } as unknown as Settlement;

        faction = {
            id: 'f1',
            blackboard: {
                stances: { expand: 0.5, exploit: 0.5 }, // Balanced
                criticalShortages: [],
                targetedHexes: []
            }
        } as unknown as Faction;

        state = {
            settlements: { 's1': settlement },
            map: {
                'h1': { id: 'h1', terrain: 'Plains', coordinate: { q: 0, r: 0, s: 0 } }
            },
            agents: {},
            factions: { 'f1': faction }
        } as unknown as WorldState;
    });

    it('should NOT prioritizing Smithy over Survival when starving', () => {
        // Run Governor
        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);

        const tickets = (faction.blackboard as any).desires || [];
        const smithyTicket = tickets.find((t: any) => t.type === 'BUILD_SMITHY');

        // In BROKEN state: Smithy Score is 1.0 (High)
        // In FIXED state: Smithy Score should be penalized or undefined
        if (smithyTicket) {
            console.log('Smithy Score:', smithyTicket.score);
            // We expect this to fail BEFORE the fix, and PASS after the fix.
            expect(smithyTicket.score).toBeUndefined();
        } else {
            expect(smithyTicket).toBeUndefined();
        }
    });

    it('should prioritize RECRUIT_VILLAGER if Food is abundant but Tools are 0', () => {
        // Scenario: Recovered Food, still no Tools.
        // Should trigger Recruit AND Smithy, but Recruit should be reasonable.
        settlement.stockpile.Food = 2000; // Abundant Food
        settlement.aiState!.surviveMode = false; // Not surviving

        // IMPORTANT: Tier must be >= 1 for Smithy now!
        settlement.tier = 1;
        settlement.population = 100; // Increase pop to allow > 2 agents (100/25 = 4)

        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);
        const tickets = (faction.blackboard as any).desires || [];

        const recruitTicket = tickets.find((t: any) => t.type === 'RECRUIT_VILLAGER');
        const smithyTicket = tickets.find((t: any) => t.type === 'BUILD_SMITHY');

        expect(recruitTicket).toBeDefined();
        // Smithy should be defined because we are Tier 1 and Not Starving
        expect(smithyTicket).toBeDefined();

        console.log('Recruit Score:', recruitTicket?.score);
        console.log('Smithy Score:', smithyTicket?.score);
    });

    it('should purchase villager if resources exist', () => {
        // Test AI Execution
        settlement.stockpile.Food = 200; // Cost is 100
        settlement.availableVillagers = 2; // Current agents
        settlement.population = 100; // Cap is 100/25 = 4 Agents.

        // Add a recruit ticket manually to Blackboard
        (faction.blackboard as any).desires = [{
            settlementId: 's1',
            type: 'RECRUIT_VILLAGER',
            score: 0.8,
            needs: ['Food']
        }];

        // Mock AI Resolve
        const ai = new AIController();
        (ai as any).resolveInstantDesires(faction, state, DEFAULT_CONFIG);

        expect(settlement.stockpile.Food).toBe(100); // 200 - 100
        expect(settlement.availableVillagers).toBe(3); // 2 + 1
    });
});
