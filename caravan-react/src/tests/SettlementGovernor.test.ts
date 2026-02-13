import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { WorldState, Faction, Settlement, HexCell, Resources } from '../types/WorldTypes';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';

describe('Settlement Governor (Ambition System)', () => {
    let state: WorldState;
    let faction: Faction;
    let config: GameConfig;

    beforeEach(() => {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        faction = {
            id: 'f1',
            name: 'Faction 1',
            color: '#000000',
            blackboard: {
                factionId: 'f1',
                stances: { expand: 0.5, exploit: 0.5 },
                criticalShortages: [],
                targetedHexes: [],
                desires: []
            }
        };

        state = {
            tick: 100,
            map: {},
            settlements: {},
            agents: {},
            factions: { 'f1': faction },
            width: 10,
            height: 10
        };
    });

    const createSettlement = (id: string, pop: number, food: number): Settlement => {
        return {
            id,
            name: `Settlement ${id}`,
            ownerId: 'f1',
            hexId: '0,0',
            population: pop,
            stockpile: { Food: food, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 0,
            role: 'GENERAL',
            controlledHexIds: [],
            buildings: [],
            jobCap: 20,
            workingPop: pop,
            availableVillagers: 0,
            popHistory: [],
            unreachableHexes: {}
        };
    };

    it('should generate UPGRADE ambition when population is high and stance is EXPLOIT', () => {
        const s1 = createSettlement('s1', 190, 1000); // 190/200 pop (Village cap)
        state.settlements['s1'] = s1;
        faction.blackboard!.stances.exploit = 1.0;

        SettlementGovernor.evaluate(s1, faction, state, config);

        const desires = faction.blackboard!.desires || [];
        const upgradeTicket = desires.find(d => d.type === 'UPGRADE');

        expect(upgradeTicket).toBeDefined();
        // Score = (190/200)^2 * 1.0 = 0.95^2 = ~0.90
        expect(upgradeTicket!.score).toBeGreaterThan(0.8);
    });

    it('should generate SETTLER ambition when stance is EXPAND', () => {
        const s1 = createSettlement('s1', 100, 1000);
        state.settlements['s1'] = s1;
        faction.blackboard!.stances.expand = 1.0;

        // Settler cost 50. Pop 100. Ratio = 100 / (50*2) = 1.0
        // Score = 0.8 * 1.0 * 1.0 = 0.8

        SettlementGovernor.evaluate(s1, faction, state, config);

        const desires = faction.blackboard!.desires || [];
        const ticket = desires.find(d => d.type === 'SETTLER');

        expect(ticket).toBeDefined();
        expect(ticket!.score).toBeCloseTo(0.8, 1);
    });

    it('should generate RECRUIT_VILLAGER ambition if food surplus exists', () => {
        const s1 = createSettlement('s1', 10, 5000); // Massive food surplus
        s1.jobCap = 20; // 50% job usage
        state.settlements['s1'] = s1;

        // Formula: (1.0 - (10/20)) * SurplusRatio(1.0) = 0.5 * 1.0 = 0.5

        SettlementGovernor.evaluate(s1, faction, state, config);

        const desires = faction.blackboard!.desires || [];
        const ticket = desires.find(d => d.type === 'RECRUIT_VILLAGER');

        expect(ticket).toBeDefined();
        expect(ticket!.score).toBeGreaterThan(0.4);
    });

    it('should generate TRADE_CARAVAN ambition if critical shortages exist', () => {
        const s1 = createSettlement('s1', 50, 500);
        state.settlements['s1'] = s1;
        faction.blackboard!.criticalShortages = ['Stone', 'Ore'];

        // Formula: 0.4 + (0.15 * 2) = 0.7

        SettlementGovernor.evaluate(s1, faction, state, config);

        const desires = faction.blackboard!.desires || [];
        const ticket = desires.find(d => d.type === 'TRADE_CARAVAN');

        expect(ticket).toBeDefined();
        expect(ticket!.score).toBeCloseTo(0.7, 1);
    });

    it('should NOT generate ambitions if survival mode is active (penalty check)', () => {
        const s1 = createSettlement('s1', 190, 10); // Starving
        s1.aiState = { surviveMode: true, savingFor: null, focusResources: [] };
        state.settlements['s1'] = s1;
        faction.blackboard!.stances.exploit = 1.0;

        SettlementGovernor.evaluate(s1, faction, state, config);

        const desires = faction.blackboard!.desires || [];
        const upgradeTicket = desires.find(d => d.type === 'UPGRADE');

        // Upgrade score normal: ~0.9. Penalty * 0.1 = 0.09. Threshold > 0.1
        // So it should NOT be there.
        expect(upgradeTicket).toBeUndefined();
    });
});
