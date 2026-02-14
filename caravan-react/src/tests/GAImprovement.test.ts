import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Faction, Settlement, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { calculateFitness } from '../simulation/evolution/FitnessEvaluator';
import { SimulationStats } from '../simulation/evolution/HeadlessRunner';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';
import { RecruitStrategy } from '../simulation/ai/RecruitStrategy';

describe('GA Improvement & Balance Tests', () => {
    let state: WorldState;

    beforeEach(() => {
        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'p1', resources: { Food: 1000 } } as HexCell
            },
            settlements: {},
            agents: {},
            factions: {
                'p1': {
                    id: 'p1', name: 'Player', color: 'blue',
                    blackboard: { stances: { expand: 0.5, exploit: 0.5 }, criticalShortages: [], targetedHexes: [], desires: [] }
                } as Faction
            },
            width: 10,
            height: 10
        };
    });

    it('Scenario 1: Fitness Function - Wealth Target & Expansion Rewards', () => {
        const baseStats: SimulationStats = {
            totalTicks: 1000,
            popHistory: [],
            totalFactions: 1,
            factions: {
                'p1': {
                    population: 100,
                    totalWealth: 0,
                    territorySize: 1,
                    tiersReached: 0,
                    goalsCompleted: {},
                    idleTicks: 0,
                    enteredSurviveMode: false,
                    survivalTicks: 0,
                    completionTimes: [],
                    settlersSpawned: 0,
                    settlementsFounded: 0,
                    totalTradeVolume: 0,
                    resourceWaste: 0
                }
            }
        };

        // Individual A: Expansionist (2 Settlements)
        const statsA = JSON.parse(JSON.stringify(baseStats));
        statsA.factions['p1'].settlementsFounded = 1;
        statsA.factions['p1'].totalWealth = 500;
        const fitnessA = calculateFitness(state, statsA, 'p1', 1);

        // Individual B: Stagnant (1 Settlement, High Wealth)
        const statsB = JSON.parse(JSON.stringify(baseStats));
        statsB.factions['p1'].settlementsFounded = 0;
        statsB.factions['p1'].totalWealth = 5000;
        const fitnessB = calculateFitness(state, statsB, 'p1', 1);

        console.log(`[Fitness Test] Expansionist: ${fitnessA.toFixed(0)}, Stagnant Hoarder: ${fitnessB.toFixed(0)}`);

        // EXPECTATION: Expansionist should be much higher (+2000 bonus)
        expect(fitnessA).toBeGreaterThan(fitnessB);
    });

    it('Scenario 2: Cargo Capacity - Agents should carry more', () => {
        state.settlements['s1'] = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 1, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };

        // Spawn a villager
        const agent = VillagerSystem.spawnVillager(state, 's1', '0,0', DEFAULT_CONFIG, 'GATHER')!;

        // We doubled capacity from 12 to 24 (and now 50)
        // Check config
        expect(DEFAULT_CONFIG.costs.villagers.capacity).toBe(50);
        expect(DEFAULT_CONFIG.costs.trade.capacity).toBe(200); // Updated from 100
    });

    it('Scenario 3: Labor Supply - Population to Villager Ratio (1:25)', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 5000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 0, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        // With pop 100 and ratio 25, the max villagers should be 4.
        // We set the correct config property
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        config.costs.villagers.popRatio = 25;

        // 1. Initial Check
        SettlementGovernor.evaluate(s1, state.factions['p1'], state, config);
        let desires = state.factions['p1'].blackboard?.desires || [];
        expect(desires.some(d => d.type === 'RECRUIT_VILLAGER')).toBe(true);

        // 2. Fill to cap
        s1.availableVillagers = 4;
        state.factions['p1'].blackboard!.desires = [];
        SettlementGovernor.evaluate(s1, state.factions['p1'], state, config);
        desires = state.factions['p1'].blackboard?.desires || [];

        // Should be blocked now
        expect(desires.some(d => d.type === 'RECRUIT_VILLAGER')).toBe(false);

        console.log(`[Recruit Test] Correctly capped at 4 villagers for 100 population.`);
    });
});
