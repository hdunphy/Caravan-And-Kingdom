import { createInitialState } from '../WorldState';
import { MapGenerator } from '../MapGenerator';
import { GameLoop } from '../GameLoop';
import { GameConfig } from '../../types/GameConfig';
import { WorldState } from '../../types/WorldTypes';
import { HexUtils } from '../../utils/HexUtils';

export interface HeadlessOptions {
    ticks: number;
    width: number;
    height: number;
    factionCount: number;
    onHeartbeat?: (progress: number) => void;
}

export interface SimulationStats {
    survivalTicks: number; // Cumulative ticks spent in SURVIVE mode by all settlements
    idleTicks: number; // Cumulative ticks spent IDLE by agents
    totalTicks: number; // Total ticks run
    totalFactions: number; // Total factions in the run
    popHistory: number[]; // Population snapshot regularly
    tiersReached: number; // Max tier reached by any settlement
    enteredSurviveMode: boolean; // Did they ever enter SURVIVE?
}

export class HeadlessRunner {
    static run(config: GameConfig, options: HeadlessOptions): { state: WorldState, stats: SimulationStats } {
        const state = createInitialState();
        const WIDTH = options.width;
        const HEIGHT = options.height;
        // Always generate a fresh map for robustness
        const map = MapGenerator.generate(WIDTH, HEIGHT);
        state.map = map;
        state.width = WIDTH;
        state.height = HEIGHT;

        // Initialize Factions
        const factions = ['player_1'];
        for (let i = 1; i < options.factionCount; i++) {
            factions.push(`rival_${i}`);
        }

        // Initialize Settlements for each faction
        const usedHexes: string[] = [];

        factions.forEach((factionId, index) => {
            const isPlayer = factionId === 'player_1';

            // Add Faction to state
            state.factions[factionId] = {
                id: factionId,
                name: isPlayer ? 'Player' : `Rival ${index}`,
                color: isPlayer ? '#00ccff' : '#ff0000',
                gold: 100
            };

            const startingHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, config, usedHexes);
            if (startingHex) {
                // Mark area as used to avoid overlap
                usedHexes.push(startingHex.id);
                const neighbors = HexUtils.getSpiral(startingHex.coordinate, 5); // Reserve larger area
                neighbors.forEach(n => usedHexes.push(HexUtils.getID(n)));

                // Grant initial territory
                const territory = HexUtils.getSpiral(startingHex.coordinate, 1);
                const controlledIds = territory.map(c => HexUtils.getID(c)).filter(id => map[id]);
                controlledIds.forEach(id => { if (map[id]) map[id].ownerId = factionId; });

                const id = `s_${factionId}_cap`;
                state.settlements[id] = {
                    id: id,
                    name: `${factionId} Capital`,
                    hexId: startingHex.id,
                    population: 100,
                    ownerId: factionId,
                    integrity: 100,
                    tier: 0,
                    jobCap: 100,
                    workingPop: 100,
                    availableVillagers: 2,
                    controlledHexIds: controlledIds,
                    buildings: [],
                    popHistory: [],
                    stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 }
                };
            }
        });

        const loop = new GameLoop(state, config, true); // SILENT MODE

        const stats: SimulationStats = {
            survivalTicks: 0,
            idleTicks: 0,
            totalTicks: options.ticks,
            totalFactions: options.factionCount,
            popHistory: [],
            tiersReached: 0,
            enteredSurviveMode: false
        };

        const heartbeatInterval = Math.floor(options.ticks / 10);

        for (let i = 0; i < options.ticks; i++) {
            loop.tick();

            // Heartbeat
            if (options.onHeartbeat && i > 0 && i % heartbeatInterval === 0) {
                const progress = Math.round((i / options.ticks) * 100);
                options.onHeartbeat(progress);
            }

            // Collect Stats
            let currentPop = 0;
            Object.values(state.settlements).forEach(s => {
                currentPop += s.population;
                if (s.tier > stats.tiersReached) stats.tiersReached = s.tier;
                if (s.currentGoal === 'SURVIVE') {
                    stats.survivalTicks++;
                    stats.enteredSurviveMode = true;
                }
            });

            // Sample population every 1000 ticks
            if (i % 1000 === 0) {
                stats.popHistory.push(currentPop);
            }

            // Agents are transient, but we track active ones
            Object.values(state.agents).forEach(a => {
                if (a.status === 'IDLE') stats.idleTicks++;
            });

            // Early out if everyone dies
            if (Object.keys(state.settlements).length === 0) {
                stats.totalTicks = i + 1;
                break;
            }
        }

        return { state, stats };
    }
}
