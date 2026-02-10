export type ResourceType = 'Food' | 'Timber' | 'Stone' | 'Ore' | 'Gold' | 'Tools';

export type TerrainType = 'Plains' | 'Forest' | 'Hills' | 'Mountains' | 'Water';

export interface Resources {
    Food: number;
    Timber: number;
    Stone: number;
    Ore: number;
    Tools: number;
    Gold: number;
}

export interface HexCoordinate {
    q: number;
    r: number;
    s: number; // q + r + s = 0
}

export interface HexCell {
    id: string; // "q,r"
    coordinate: HexCoordinate;
    terrain: TerrainType;
    ownerId: string | null;
    resources: Partial<Resources>; // Resources currently ON the hex (not stockpile)
}

export type GoalType = 'UPGRADE' | 'EXPAND' | 'TOOLS' | 'SURVIVE';

export type BuildingType =
    | 'GathererHut'
    | 'Warehouse'
    | 'Sawmill'
    | 'Masonry'
    | 'Smithy'
    | 'PavedRoad'
    | 'GuardPost'
    | 'Watchtower'
    | 'Barracks'
    | 'MarketHall'
    | 'Palace';

export interface BuildingInstance {
    id: string;
    type: BuildingType;
    hexId: string;
    integrity: number; // 0-100
    level: number;
}

export interface Settlement {
    id: string;
    name: string;
    hexId: string;
    ownerId: string;
    population: number;
    stockpile: Resources;
    integrity: number;
    tier: number; // 0=Village, 1=Town, 2=City

    // Workforce
    jobCap: number;
    workingPop: number;
    availableVillagers: number; // Idle villagers ready to be deployed
    controlledHexIds: string[]; // Hexes this city owns/works
    buildings: BuildingInstance[];

    // Stats
    resourceChange?: Partial<Resources>;

    // AI
    currentGoal?: GoalType;
    lastGrowth?: number;
}

export interface Faction {
    id: string;
    name: string;
    color: string;
    type?: 'Player' | 'AI'; // Add type
    gold?: number; // Global gold? Or per settlement? Let's keep it here for now if needed.
}

import { AgentEntity } from './AgentTypes';

export interface WorldState {
    tick: number;
    map: Record<string, HexCell>;
    settlements: Record<string, Settlement>;
    agents: Record<string, AgentEntity>;
    factions: Record<string, Faction>; // For now just Player
    width: number;
    height: number;
}
