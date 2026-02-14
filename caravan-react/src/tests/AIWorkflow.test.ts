
import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { AIController } from '../simulation/ai/AIController';
import { WorldState, Settlement, Faction } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { JobPool } from '../simulation/ai/JobPool';

describe('AI Workflow Review', () => {
    let state: WorldState;
    let settlement: Settlement;
    let faction: Faction;
    let controller: AIController;

    beforeEach(() => {
        const jobPool = new JobPool('player_1');
        faction = {
            id: 'player_1',
            name: 'Player',
            color: '#0000ff',
            jobPool: jobPool,
            blackboard: {
                stances: { expand: 0.5, exploit: 0.5 },
                desires: [],
                criticalShortages: [],
                targetedHexes: []
            }
        } as any;

        settlement = {
            id: 's1',
            name: 'Capital',
            hexId: '0,0',
            ownerId: 'player_1',
            population: 100,
            tier: 1,
            stockpile: { Food: 500, Timber: 500, Stone: 500, Ore: 500, Tools: 0, Gold: 100 },
            buildings: [],
            controlledHexIds: [],
            availableVillagers: 0,
            aiState: { surviveMode: false }
        } as any;

        state = {
            tick: 0,
            map: { '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'player_1', resources: {} } },
            settlements: { 's1': settlement },
            agents: {},
            factions: { 'player_1': faction },
            width: 10,
            height: 10
        } as any;

        controller = new AIController();
    });

    it('should NOT generate desires for existing buildings', () => {
        // 1. Give resources for Granite (Granary)
        settlement.role = 'GRANARY';
        settlement.stockpile.Food = 0; // Trigger need (Low Food Health)

        // 2. Pre-build Granary
        settlement.buildings.push({
            id: 'b1',
            type: 'Granary',
            hexId: '0,0',
            integrity: 100,
            level: 1
        });

        // 3. Run Governor
        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);

        // 4. Expect NO Granary desire
        const granaryDesire = faction.blackboard?.desires.find(d => d.type === 'BUILD_GRANARY');
        expect(granaryDesire).toBeUndefined();
    });

    it('should generate desire if building missing', () => {
        settlement.role = 'GRANARY';
        settlement.stockpile.Food = 0; // Trigger need
        settlement.buildings = []; // No Granary

        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);

        const granaryDesire = faction.blackboard?.desires.find(d => d.type === 'BUILD_GRANARY');
        expect(granaryDesire).toBeDefined();
    });

    it('should spawn a caravan when TRADE_CARAVAN desire exists', () => {
        // 1. Inject Desire
        faction.blackboard!.desires.push({
            settlementId: settlement.id,
            type: 'TRADE_CARAVAN',
            score: 1.0,
            needs: ['Timber']
        });

        // 2. Run Controller
        // We need to bypass the update loop and call resolveInstantDesires via update if possible, 
        // or just expose it. update() calls it at the end.
        controller.update(state, DEFAULT_CONFIG);

        // 3. Expect Agent Spawn
        const caravans = Object.values(state.agents).filter(a => a.type === 'Caravan');
        expect(caravans.length).toBe(1);
        expect(caravans[0].ownerId).toBe('player_1');
        expect(settlement.stockpile.Timber).toBe(450); // 500 - 50 cost
    });
});
