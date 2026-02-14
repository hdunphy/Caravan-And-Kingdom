
import { describe, it, expect, beforeEach } from 'vitest';
import { CaravanSystem } from '../simulation/systems/CaravanSystem';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { GOAPPlanner } from '../simulation/ai/GOAPPlanner';
import { JobPool } from '../simulation/ai/JobPool';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { WorldState, Faction, Settlement, Resources, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';

describe('Caravan Trade Logic', () => {
    let state: WorldState;
    let faction: Faction;
    let capital: Settlement;
    let neighbor: Settlement;
    let jobPool: JobPool;

    beforeEach(() => {
        jobPool = new JobPool('f1');

        faction = {
            id: 'f1',
            name: 'Merchants',
            color: 'gold',
            blackboard: {
                factionId: 'f1',
                stances: { expand: 0.5, exploit: 0.5 },
                criticalShortages: ['Food'], // Force trade desire
                targetedHexes: [],
                desires: []
            },
            jobPool: jobPool,
            stats: { totalTrades: 0, tradeResources: {}, settlersSpawned: 0, settlementsFounded: 0 }
        } as unknown as Faction;

        capital = {
            id: 's1',
            ownerId: 'f1',
            hexId: '0,0',
            population: 100,
            tier: 1,
            stockpile: { Food: 10, Timber: 100, Stone: 0, Ore: 0, Gold: 500, Tools: 0 }, // Low Food, High Gold
            resourceGoals: { Food: 500 },
            availableVillagers: 5,
            buildings: [],
            controlledHexIds: [],
            role: 'GENERAL'
        } as Settlement;

        neighbor = {
            id: 's2',
            ownerId: 'f1',
            hexId: '0,5', // Distance 5
            population: 100,
            tier: 1,
            stockpile: { Food: 1000, Timber: 100, Stone: 0, Ore: 0, Gold: 0, Tools: 0 }, // High Food
            availableVillagers: 5,
            buildings: [],
            controlledHexIds: [],
            role: 'GENERAL'
        } as Settlement;

        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1' } as HexCell,
                '0,5': { id: '0,5', coordinate: { q: 0, r: 5, s: -5 }, terrain: 'Plains', ownerId: 'f1' } as HexCell
            },
            settlements: { s1: capital, s2: neighbor },
            agents: {},
            factions: { f1: faction },
            width: 10,
            height: 10
        };
    });

    it('should generate TRADE_CARAVAN desire when shortages exist', () => {
        SettlementGovernor.evaluate(capital, faction, state, DEFAULT_CONFIG);
        const desires = faction.blackboard?.desires || [];
        const tradeDesire = desires.find(d => d.type === 'TRADE_CARAVAN');

        // This relies on config thresholds.
        // If config.ai.governor.weights.tradeShortage is high enough.
        // Shortages = 1 (Food).
        expect(tradeDesire).toBeDefined();
    });

    it('should create a TRADE job from the desire', () => {
        // Force desire
        faction.blackboard!.desires = [{
            settlementId: 's1',
            type: 'TRADE_CARAVAN',
            score: 0.9,
            needs: ['Timber']
        }];

        GOAPPlanner.plan(faction, jobPool, state, DEFAULT_CONFIG);

        const job = jobPool.getAllJobs().find(j => j.type === 'TRADE');
        expect(job).toBeDefined();
        expect(job?.sourceId).toBe('s1');
    });

    it('should NOT drop the TRADE job when claimed by a Caravan', () => {
        // Setup existing job
        jobPool.addJob({
            jobId: 'f1-s1-TRADE-GENERIC',
            factionId: 'f1',
            sourceId: 's1',
            type: 'TRADE',
            priority: 1.0,
            urgency: 'HIGH',
            targetVolume: 1,
            assignedVolume: 0,
            status: 'OPEN'
        });

        // Spawn Idle Caravan
        const caravan = CaravanSystem.spawn(state, '0,0', '0,0', 'Caravan', DEFAULT_CONFIG)!;
        caravan.ownerId = 'f1';
        caravan.homeId = 's1';
        caravan.status = 'IDLE';

        // Update System
        CaravanSystem.update(state, DEFAULT_CONFIG);

        // Expectation: Caravan should have claimed the job AND have a mission
        // Currently BROKEN: It claims, then releases.

        expect(caravan.jobId).toBe('f1-s1-TRADE-GENERIC');
        expect(caravan.mission).not.toBe('IDLE'); // This will fail if logic is missing
    });
});
