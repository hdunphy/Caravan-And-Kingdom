import { createInitialState } from '../WorldState';
import { MapGenerator } from '../MapGenerator';
import { GameLoop } from '../GameLoop';
import { GameConfig } from '../../types/GameConfig';
import { WorldState } from '../../types/WorldTypes';
import { HexUtils } from '../../utils/HexUtils';

export class HeadlessRunner {
    static run(config: GameConfig, ticks: number): WorldState {
        const state = createInitialState();
        const WIDTH = 20;
        const HEIGHT = 20;
        const map = MapGenerator.generate(WIDTH, HEIGHT);
        state.map = map;
        state.width = WIDTH;
        state.height = HEIGHT;

        // Initialize same way as useGameSimulation (Simplified)
        const startingHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, config, []);
        if (startingHex) {
            const neighbors = HexUtils.getSpiral(startingHex.coordinate, 1);
            const controlledIds = neighbors.map(c => HexUtils.getID(c)).filter(id => map[id]);
            controlledIds.forEach(id => { if (map[id]) map[id].ownerId = 'player_1'; });

            state.settlements['capital'] = {
                id: 'capital',
                name: 'Capital',
                hexId: startingHex.id,
                population: 100,
                ownerId: 'player_1',
                integrity: 100,
                tier: 0,
                jobCap: 100,
                workingPop: 100,
                availableVillagers: 2,
                controlledHexIds: controlledIds,
                buildings: [],
                stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 }
            };
        }

        const loop = new GameLoop(state, config);
        
        for (let i = 0; i < ticks; i++) {
            loop.tick();
            // Early out if everyone dies
            if (Object.keys(state.settlements).length === 0) break;
        }

        return state;
    }
}
