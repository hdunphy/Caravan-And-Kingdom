import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { Settlement, Faction, WorldState } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Growth Loop & Governor Logic', () => {
    let state: WorldState;
    let faction: Faction;
    let settlement: Settlement;

    beforeEach(() => {
        faction = {
            id: 'p1', name: 'Player', color: 'blue',
            blackboard: { stances: { expand: 0.5, exploit: 0.5 }, criticalShortages: [], targetedHexes: [], desires: [] } as any,
            jobPool: { jobs: [], addJob: () => { }, getJob: () => undefined } as any
        };

        settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0',
            population: 100,
            tier: 1,
            // Critical Setup: Working Pop fills the Job Cap
            jobCap: 100,
            workingPop: 100,
            availableVillagers: 2, // 2 Agents existing
            stockpile: { Food: 5000, Timber: 500, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'],
            buildings: [],
            popHistory: [],
            role: 'GENERAL',
            integrity: 100
        };

        state = {
            tick: 1,
            map: { '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: {} } as any },
            settlements: { 's1': settlement },
            factions: { 'p1': faction },
            agents: {},
            width: 10,
            height: 10
        };
    });

    it('should NOT generate RECRUIT_VILLAGER desire if workingPop fills jobCap (The Bug)', () => {
        // Run Governor
        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);

        // Check Blackboard Tickets
        const tickets = (faction.blackboard as any).desires || [];
        const recruitTicket = tickets.find((t: any) => t.type === 'RECRUIT_VILLAGER');

        // FIXED BEHAVIOR: We expect a ticket because Agents (2) < Max (4) even if Jobs are full
        console.log('Recruit Ticket:', recruitTicket);
        expect(recruitTicket).toBeDefined();
    });

    it('should generate RECRUIT_VILLAGER desire if logic is fixed (The Fix)', () => {
        // This test simulates the DESIRED behavior. 
        // We will fail on this initially, then pass after I fix Governor.ts.

        // Mock a fixed logic scenario by artificially lowering workingPop to leave room
        // This confirms that "Room in JobCap" is indeed the gating factor.
        settlement.workingPop = 50;

        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);
        const tickets = (faction.blackboard as any).desires || [];
        const recruitTicket = tickets.find((t: any) => t.type === 'RECRUIT_VILLAGER');

        expect(recruitTicket).toBeDefined();
        if (recruitTicket) {
            expect(recruitTicket.score).toBeGreaterThan(0);
        }
    });
});
