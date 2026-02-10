import { WorldState, Faction } from '../types/WorldTypes';

export const FactionManager = {
    // Initialize Factions
    init(state: WorldState) {
        // Ensure Player exists
        if (!state.factions['player_1']) {
            state.factions['player_1'] = {
                id: 'player_1',
                name: 'Player Empire',
                color: '#3b82f6', // Blue
                type: 'Player'
            };
        }

        // Add Rivals if not exist
        if (!state.factions['rival_1']) {
            state.factions['rival_1'] = {
                id: 'rival_1',
                name: 'The Iron Pact',
                color: '#ef4444', // Red
                type: 'AI'
            };
        }
    },

    // Helpes
    getFaction(state: WorldState, id: string): Faction | undefined {
        return state.factions[id];
    }
};
