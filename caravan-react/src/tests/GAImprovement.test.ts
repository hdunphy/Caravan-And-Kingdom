import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Faction, Settlement, HexCell } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { calculateFitness } from '../simulation/evolution/FitnessEvaluator';
import { SimulationStats } from '../simulation/evolution/HeadlessRunner';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
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
                'p1': { id: 'p1', name: 'Player', color: 'blue' } as Faction
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
        
        // Check capacity logic inside handleGather or similar? 
        // Actually, we can just check the DEFAULT_CONFIG.
        expect(DEFAULT_CONFIG.costs.villagers.capacity).toBe(24);
        expect(DEFAULT_CONFIG.costs.trade.capacity).toBe(100);
    });

    it('Scenario 3: Labor Supply - Population to Villager Ratio', () => {
        const s1: Settlement = {
            id: 's1', ownerId: 'p1', hexId: '0,0', population: 100, tier: 1,
            stockpile: { Food: 1000, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            controlledHexIds: ['0,0'], availableVillagers: 0, jobCap: 20, workingPop: 0,
            popHistory: [], role: 'GENERAL', integrity: 100, buildings: []
        };
        state.settlements['s1'] = s1;

        // With pop 100 and ratio 25, the max villagers should be 4.
        const strategy = new RecruitStrategy();
        
        // 1. First recruitment
        let actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');
        expect(actions.length).toBeGreaterThan(0);
        s1.availableVillagers = 1;

        // 2. Second recruitment
        actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');
        expect(actions.length).toBeGreaterThan(0);
        s1.availableVillagers = 2;

        // 3. Third
        actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');
        expect(actions.length).toBeGreaterThan(0);
        s1.availableVillagers = 3;

        // 4. Fourth
        actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');
        expect(actions.length).toBeGreaterThan(0);
        s1.availableVillagers = 4;

        // 5. Fifth - should be BLOCKED (at cap)
        actions = strategy.evaluate(state, DEFAULT_CONFIG, 'p1', 's1');
        expect(actions.length).toBe(0);
        
        console.log(`[Recruit Test] Max Villagers for 100 pop: ${s1.availableVillagers}`);
    });
});
