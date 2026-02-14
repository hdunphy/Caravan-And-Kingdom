import { createInitialState } from '../WorldState.ts';
import { MapGenerator } from '../MapGenerator.ts';
import { GameLoop } from '../GameLoop.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { WorldState, ResourceType } from '../../types/WorldTypes.ts';
import { HexUtils } from '../../utils/HexUtils.ts';
import { Pathfinding } from '../Pathfinding.ts';

export interface HeadlessOptions {
    ticks: number;
    width: number;
    height: number;
    factionConfigs: GameConfig[]; // Replaces factionCount
    onHeartbeat?: (progress: number) => void;
    useWorker?: boolean;
}

export interface FactionStats {
    survivalTicks: number; // Cumulative ticks spent in SURVIVE mode
    idleTicks: number; // Cumulative ticks spent IDLE by agents
    goalsCompleted: Record<string, number>; // e.g. UPGRADE: 2, SETTLER: 1
    completionTimes: number[]; // Tick timestamps of completions
    tiersReached: number;
    enteredSurviveMode: boolean;
    population: number;
    territorySize: number;
    totalWealth: number;
    settlersSpawned: number;
    settlementsFounded: number;
    totalTradeVolume: number;
    resourceWaste: number;
    totalTrades: number;
    tradeResources: Partial<Record<ResourceType, number>>;
    maxCaravans: number;
}

export interface SimulationStats {
    totalTicks: number;
    totalFactions: number;
    popHistory: number[]; // Global population snapshot
    factions: Record<string, FactionStats>; // Stats per faction
}

import { Logger } from '../../utils/Logger.ts';

export class HeadlessRunner {
    static run(globalConfig: GameConfig, options: HeadlessOptions): { state: WorldState, stats: SimulationStats } {
        Logger.getInstance().setSilent(true);

        // 1. Shared Environment Setup
        const state = createInitialState();
        const WIDTH = options.width;
        const HEIGHT = options.height;
        const map = MapGenerator.generate(WIDTH, HEIGHT);
        state.map = map;
        state.width = WIDTH;
        state.height = HEIGHT;

        // Clear Pathfinding Cache for fairness between runs, but share it during this run
        Pathfinding.clearCache();

        // 2. Initialize Factions with specific Genomes
        const usedHexes: string[] = [];
        const factionStats: Record<string, FactionStats> = {};

        // Map faction ID to its specific config for the game loop to use?
        // The GameLoop currently uses a single 'config'. 
        // We need to patch the GameLoop or the Agents to use their faction's config.
        // For now, we will store the config on the Faction object itself if possible, 
        // or we have to accept that GameLoop might need refactoring to support multi-config.
        // Checking WorldTypes... Faction doesn't have config.
        // Workaround: We will use the 'globalConfig' for world rules (costs, yields),
        // but individual agents/governors need to know their genes.
        // We can attach the gene-derived values to the Faction Blackboard or a new 'aiConfig' property on Faction.
        // Let's attach it to Faction.aiConfig (we might need to extend the type or use any).

        options.factionConfigs.forEach((factionConfig, index) => {
            const factionId = index === 0 ? 'player_1' : `rival_${index}`;
            const isPlayer = index === 0;

            // Initialize Stats
            factionStats[factionId] = {
                survivalTicks: 0,
                idleTicks: 0,
                goalsCompleted: {},
                completionTimes: [],
                tiersReached: 0,
                enteredSurviveMode: false,
                population: 0,
                territorySize: 0,
                totalWealth: 0,
                settlersSpawned: 0,
                settlementsFounded: 0,
                totalTradeVolume: 0,
                resourceWaste: 0,
                totalTrades: 0,
                tradeResources: {},
                maxCaravans: 0
            };

            // Create Faction
            state.factions[factionId] = {
                id: factionId,
                name: isPlayer ? 'Player' : `Rival ${index}`,
                color: isPlayer ? '#00ccff' : (index === 1 ? '#ff0000' : '#00ff00'),
                gold: 100,
                blackboard: {
                    factionId: factionId,
                    stances: { expand: 0.5, exploit: 0.5 },
                    criticalShortages: [],
                    targetedHexes: []
                },
                stats: {
                    totalTrades: 0,
                    tradeResources: {},
                    settlersSpawned: 0,
                    settlementsFounded: 0
                }
            };

            // Store Config on Faction (Runtime Patch)
            (state.factions[factionId] as any).aiConfig = factionConfig;

            // Spawn Capital
            const startingHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, globalConfig, usedHexes);
            if (startingHex) {
                usedHexes.push(startingHex.id);
                // Reserve area
                const neighbors = HexUtils.getSpiral(startingHex.coordinate, 5);
                neighbors.forEach(n => usedHexes.push(HexUtils.getID(n)));

                // Grant Territory
                const radius = globalConfig.upgrades.villageToTown.radius || 2;
                const territory = HexUtils.getSpiral(startingHex.coordinate, radius);
                const controlledIds = territory.map(c => HexUtils.getID(c)).filter(id => map[id]);
                controlledIds.forEach(id => { if (map[id]) map[id].ownerId = factionId; });

                const id = `s_${factionId}_cap`;
                state.settlements[id] = {
                    id: id,
                    name: `${state.factions[factionId].name} Capital`,
                    hexId: startingHex.id,
                    population: 100,
                    ownerId: factionId,
                    integrity: 100,
                    tier: 1,
                    jobCap: 100,
                    workingPop: 100,
                    availableVillagers: 2,
                    controlledHexIds: controlledIds,
                    buildings: [],
                    popHistory: [],
                    stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                    role: 'GENERAL'
                };
            }
        });

        // 3. Run Simulation
        const loop = new GameLoop(state, globalConfig); // Global rules apply

        // Patch loop to use faction-specific AI configs?
        // The GameLoop calls system updates. 
        // We need to ensure that when Governor/Sovereign AI runs, it uses the FACTION's config.
        // This requires a change in GameLoop or the Systems to look up config from Faction.
        // For this milestone, we will assume we modify the Systems to check for faction.aiConfig
        // BUT we are only changing HeadlessRunner here. 
        // MAJOR REFACTOR RISK: If we don't change Systems, they use globalConfig.
        // We should wrap the systems or injecting the config.
        // For now, let's proceed with the runner logic and we might need to touch Systems next.

        const stats: SimulationStats = {
            totalTicks: options.ticks,
            totalFactions: options.factionConfigs.length,
            popHistory: [],
            factions: factionStats
        };

        // const heartbeatInterval = Math.floor(options.ticks / 10);

        for (let i = 0; i < options.ticks; i++) {
            // Snapshot counts for event tracking
            const prevSettlers: Record<string, number> = {};
            const prevSettlements: Record<string, number> = {};
            // const prevResourceStock: Record<string, number> = {};

            Object.keys(state.factions).forEach(fId => {
                prevSettlers[fId] = Object.values(state.agents).filter(a => a.type === 'Settler' && a.ownerId === fId).length;
                prevSettlements[fId] = Object.values(state.settlements).filter(s => s.ownerId === fId).length;

                // Track total non-gold resource stock for trade volume proxy?
                // Actually, let's track Gold changes from Trade specifically if possible.
                // For now, simpler: Track Gold increase in settlements that aren't the capital?
            });

            loop.tick();

            // Collect Stats
            let currentPop = 0;
            const activeFactions = new Set<string>();

            // Post-Tick Event Detection
            Object.keys(state.factions).forEach(fId => {
                const fStats = stats.factions[fId];
                if (!fStats) return;

                const currentSettlers = Object.values(state.agents).filter(a => a.type === 'Settler' && a.ownerId === fId).length;
                if (currentSettlers > prevSettlers[fId]) {
                    fStats.settlersSpawned += (currentSettlers - prevSettlers[fId]);
                }

                const currentSettlements = Object.values(state.settlements).filter(s => s.ownerId === fId).length;
                if (currentSettlements > prevSettlements[fId]) {
                    fStats.settlementsFounded += (currentSettlements - prevSettlements[fId]);
                }

                // Alternative: Track Gold inflow from Trade.
            });

            // Resource Waste Tracking
            Object.values(state.map).forEach(hex => {
                if (hex.ownerId && hex.resources) {
                    const fStats = stats.factions[hex.ownerId];
                    if (fStats) {
                        const amount = Object.values(hex.resources).reduce((a, b) => a + b, 0);
                        fStats.resourceWaste += amount;
                    }
                }
            });

            Object.values(state.settlements).forEach(s => {
                const fStats = stats.factions[s.ownerId];
                if (!fStats) return;

                currentPop += s.population;
                activeFactions.add(s.ownerId);

                // Track Goals
                if (s.tier > fStats.tiersReached) {
                    fStats.tiersReached = s.tier;
                    fStats.completionTimes.push(i);
                    fStats.goalsCompleted['TIER_UP'] = (fStats.goalsCompleted['TIER_UP'] || 0) + 1;
                }

                if (s.aiState?.surviveMode) {
                    fStats.survivalTicks++;
                    fStats.enteredSurviveMode = true;
                }
            });

            // Sample global pop
            if (i % 1000 === 0) {
                stats.popHistory.push(currentPop);
            }

            // Track Idle
            Object.values(state.agents).forEach(a => {
                const fStats = stats.factions[a.ownerId];
                if (fStats && a.status === 'IDLE') fStats.idleTicks++;

                // Track Max Caravans
                if (fStats && a.type === 'Caravan') {
                    const currentCaravans = Object.values(state.agents).filter(agent => agent.type === 'Caravan' && agent.ownerId === a.ownerId).length;
                    fStats.maxCaravans = Math.max(fStats.maxCaravans, currentCaravans);
                }
            });

            // Strategic Early Out (Tick 3000)
            if (i === 3000) {
                Object.values(stats.factions).forEach(f => {
                    // Check if stagnation
                    const hasAchievement = f.tiersReached > 1 || Object.keys(f.goalsCompleted).length > 0;
                    if (!hasAchievement) {
                        // Apply Stagnation Penalty later, but for now we basically mark them dead?
                        // Or we just stop the run if EVERYONE is stagnant?
                    }
                });
            }

            // Extinction Check
            if (activeFactions.size === 0) {
                stats.totalTicks = i + 1;
                break;
            }
        }

        // Finalize Stats
        Object.values(state.factions).forEach(f => {
            const fStats = stats.factions[f.id];
            if (fStats) {
                fStats.totalWealth = f.gold || 0;
                // ... calculate territory size ...
                fStats.territorySize = Object.values(state.map).filter(h => h.ownerId === f.id).length;

                // Copy cumulative stats from faction object
                if (f.stats) {
                    fStats.totalTrades = f.stats.totalTrades;
                    fStats.tradeResources = f.stats.tradeResources;
                    fStats.settlersSpawned = f.stats.settlersSpawned;
                    fStats.settlementsFounded = f.stats.settlementsFounded;
                }

                // Calculate Settlement Pops
                fStats.population = Object.values(state.settlements)
                    .filter(s => s.ownerId === f.id)
                    .reduce((sum, s) => sum + s.population, 0);
            }
        });

        return { state, stats };
    }
}

