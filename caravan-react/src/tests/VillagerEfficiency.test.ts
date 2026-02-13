import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, Faction, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { VillagerSystem } from '../simulation/systems/VillagerSystem';
import { JobPool } from '../simulation/ai/JobPool';
import { BlackboardDispatcher } from '../simulation/ai/BlackboardDispatcher';
import { HexUtils } from '../utils/HexUtils';

describe('Villager Efficiency and Distribution', () => {
    let state: WorldState;
    let faction: Faction;
    let settlement: Settlement;
    let jobPool: JobPool;

    beforeEach(() => {
        faction = {
            id: 'f1',
            name: 'Faction 1',
            color: '#ff0000',
            blackboard: {
                factionId: 'f1',
                stances: { expand: 0.5, exploit: 0.5 },
                criticalShortages: [],
                targetedHexes: []
            }
        };

        jobPool = new JobPool('f1');
        faction.jobPool = jobPool;

        settlement = {
            id: 's1',
            name: 'Settlement 1',
            hexId: '0,0',
            ownerId: 'f1',
            population: 100,
            stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Tools: 0, Gold: 0 },
            integrity: 100,
            tier: 1,
            role: 'GENERAL',
            controlledHexIds: ['0,0', '1,0', '0,1'], // Three controlled hexes
            buildings: [],
            availableVillagers: 2, // Start with 2 available
            popHistory: [],
            jobCap: 10,
            workingPop: 0
        };

        state = {
            tick: 1,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'f1', resources: {} },
                '1,0': { id: '1,0', coordinate: { q: 1, r: 0, s: -1 }, terrain: 'Forest', ownerId: 'f1', resources: { Timber: 100 } },
                '0,1': { id: '0,1', coordinate: { q: 0, r: 1, s: -1 }, terrain: 'Forest', ownerId: 'f1', resources: { Timber: 100 } }
            },
            settlements: { 's1': settlement },
            agents: {},
            factions: { 'f1': faction },
            width: 10,
            height: 10
        };
    });

    it('should dispatch BOTH available villagers if job volume allows', () => {
        // Create a job with volume 40 (2 villagers * 20 each)
        jobPool.addJob({
            jobId: 'job1',
            factionId: 'f1',
            sourceId: 's1',
            type: 'COLLECT',
            resource: 'Timber',
            urgency: 'HIGH',
            priority: 1.0,
            targetVolume: 40,
            assignedVolume: 0,
            status: 'OPEN'
        });

        // Run system update
        VillagerSystem.update(state, DEFAULT_CONFIG);

        // Check agents
        const agents = Object.values(state.agents).filter(a => a.ownerId === 'f1');
        expect(agents.length).toBe(2);
        expect(settlement.availableVillagers).toBe(0);
    });

    it('should distribute workers across different resource hexes', () => {
        // Create a job with volume 40
        jobPool.addJob({
            jobId: 'job1',
            factionId: 'f1',
            sourceId: 's1',
            type: 'COLLECT',
            resource: 'Timber',
            urgency: 'HIGH',
            priority: 1.0,
            targetVolume: 40,
            assignedVolume: 0,
            status: 'OPEN'
        });

        // Run system update
        VillagerSystem.update(state, DEFAULT_CONFIG);

        const agents = Object.values(state.agents) as any[];
        expect(agents.length).toBe(2);

        // Verify they are going to DIFFERENT hexes
        const targets = agents.map(a => HexUtils.getID(a.gatherTarget));
        const uniqueTargets = new Set(targets);

        // This is expected to FAIL currently because of the .find() logic in manageIdleAnt
        expect(uniqueTargets.size).toBe(2);
        expect(uniqueTargets).toContain('1,0');
        expect(uniqueTargets).toContain('0,1');
    });
});
