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
    aiState?: {
        surviveMode: boolean; // "General Stand-Down"
        savingFor: 'FLEET' | 'UPGRADE' | null; // "Gold Reserve" / "Material Lock"
        focusResources: string[]; // For HR Governor
        lastDecisions?: Record<string, string[]>; // Governor -> decisions
    };
    popHistory: number[]; // Last 100 ticks of population
}

export interface Faction {
    id: string;
    name: string;
    color: string;
    type?: 'Player' | 'AI'; // Add type
    gold?: number; // Global gold? Or per settlement? Let's keep it here for now if needed.
}

export type AgentType = 'Caravan' | 'Scout' | 'Army' | 'Settler' | 'Villager';

export interface BaseAgent {
    id: string;
    ownerId: string;
    position: HexCoordinate;
    target: HexCoordinate | null;
    path: HexCoordinate[];
    cargo: Partial<Resources>;
    integrity: number;
    waitTicks?: number;
    activity?: 'MOVING' | 'LOADING' | 'UNLOADING' | 'IDLE';
    status?: 'IDLE' | 'BUSY' | 'RETURNING';
    movementProgress?: number;
}

export interface CaravanAgent extends BaseAgent {
    type: 'Caravan';
    homeId?: string;
    targetSettlementId?: string;
    mission?: 'TRADE' | 'LOGISTICS' | 'IDLE'; // Logistics = gathering
    tradeState?: 'OUTBOUND' | 'INBOUND';
    tradeResource?: keyof Resources;
}

export interface SettlerAgent extends BaseAgent {
    type: 'Settler';
}

export interface VillagerAgent extends BaseAgent {
    type: 'Villager';
    homeId: string; // Villagers always belong to a settlement
    mission?: 'GATHER' | 'IDLE';
    gatherTarget?: HexCoordinate;
    resourceType?: keyof Resources;
}

export interface ScoutAgent extends BaseAgent {
    type: 'Scout';
}

export interface ArmyAgent extends BaseAgent {
    type: 'Army';
}

export type AgentEntity = CaravanAgent | SettlerAgent | VillagerAgent | ScoutAgent | ArmyAgent;

export interface WorldState {
    tick: number;
    map: Record<string, HexCell>;
    settlements: Record<string, Settlement>;
    agents: Record<string, AgentEntity>;
    factions: Record<string, Faction>; // For now just Player
    width: number;
    height: number;
}
