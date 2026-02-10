import { WorldState, Faction, Resources } from '../types/WorldTypes';

export const INITIAL_RESOURCES: Resources = {
    Food: 50,
    Timber: 0,
    Stone: 0,
    Ore: 0,
    Tools: 0,
    Gold: 0
};

export const createInitialState = (): WorldState => {
    const playerFaction: Faction = {
        id: 'player_1',
        name: 'Player Empire',
        color: '#3b82f6' // Blue-500
    };

    return {
        tick: 0,
        map: {},
        settlements: {},
        agents: {},
        factions: {
            'player_1': playerFaction,
            'rival_1': {
                id: 'rival_1',
                name: 'The Iron Pact',
                color: '#ef4444', // Red
                type: 'AI'
            }
        },
        width: 10,
        height: 10
    };
};
