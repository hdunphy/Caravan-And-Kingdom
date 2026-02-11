import { useState, useEffect, useRef } from 'react';
import { WorldState } from '../types/WorldTypes';
import { GameLoop } from '../simulation/GameLoop';
import { createInitialState } from '../simulation/WorldState'; // Factory
import { MapGenerator } from '../simulation/MapGenerator'; // Correction: MapGenerator logic needed
import { HexUtils } from '../utils/HexUtils';
import { useGameConfig } from '../contexts/GameConfigContext';


export function useGameSimulation() {
    const loopRef = useRef<GameLoop | null>(null);
    const [gameState, setGameState] = useState<WorldState | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const { config } = useGameConfig();

    // Initialize
    useEffect(() => {
        const state = createInitialState();
        const WIDTH = 20;
        const HEIGHT = 20;
        const map = MapGenerator.generate(WIDTH, HEIGHT);
        state.map = map;
        state.width = WIDTH;
        state.height = HEIGHT;

        // Find Spawn Location
        const startingHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, config, []);

        if (startingHex) {
            const startId = startingHex.id;

            // Set Capital Ownership (Center + Neighbors)
            // Use HexUtils to get neighbors for initial control
            const neighbors = HexUtils.getSpiral(startingHex.coordinate, 1);
            const controlledIds = neighbors.map(c => HexUtils.getID(c)).filter(id => map[id]);

            controlledIds.forEach(id => {
                if (map[id]) map[id].ownerId = 'player_1';
            });

            // Spawn a Capital Settlement
            state.settlements['capital'] = {
                id: 'capital',
                name: 'Capital',
                hexId: startId,
                population: 100,
                ownerId: 'player_1',
                integrity: 100,
                tier: 0,
                resourceChange: {},
                workingPop: 100,
                jobCap: 100, // Will be updated by ExtractionSystem
                controlledHexIds: controlledIds,
                buildings: [],
                popHistory: [],
                stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                availableVillagers: 2 // Capital starts with 2 free villagers
            };

            // Spawn Rival Faction "The Iron Pact"
            const rivalHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, config, Object.values(state.settlements));
            if (rivalHex) {
                const rivalId = rivalHex.id;
                const neighbors = HexUtils.getSpiral(rivalHex.coordinate, 1);
                const controlledIds = neighbors.map(c => HexUtils.getID(c)).filter(id => map[id]);

                controlledIds.forEach(id => {
                    if (map[id]) map[id].ownerId = 'rival_1';
                });

                state.settlements['iron_pact_capital'] = {
                    id: 'iron_pact_capital',
                    name: 'Iron Hold',
                    hexId: rivalId,
                    population: 100,
                    ownerId: 'rival_1',
                    integrity: 100,
                    tier: 0,
                    resourceChange: {},
                    workingPop: 100,
                    jobCap: 100,
                    controlledHexIds: controlledIds,
                    buildings: [],
                    popHistory: [],
                    stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 },
                    availableVillagers: 2 // Rival capital
                };
            }

        } else {
            console.error("Could not find a valid starting location!");
        }

        loopRef.current = new GameLoop(state, config);
        setGameState({ ...state });
    }, []);

    // Update Config in Loop
    useEffect(() => {
        if (loopRef.current) {
            loopRef.current.config = config;
        }
    }, [config]);

    // Tick Loop
    useEffect(() => {
        if (!isRunning) return;

        const interval = setInterval(() => {
            if (loopRef.current) {
                loopRef.current.tick();
                setGameState({ ...loopRef.current.getState() });
            }
        }, config.simulation.tickRate);

        return () => clearInterval(interval);
    }, [isRunning, config.simulation.tickRate]);

    const togglePause = () => setIsRunning(!isRunning);
    const reset = () => window.location.reload(); // Lazy reset for now

    const spawnTestCaravan = () => {
        if (loopRef.current) {
            // Force Trade Logic
            loopRef.current.forceTrade();
            setGameState({ ...loopRef.current.getState() });
        }
    };

    return { gameState, isRunning, togglePause, reset, spawnTestCaravan };
}
