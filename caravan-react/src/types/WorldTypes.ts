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

export type SettlementRole = 'GENERAL' | 'LUMBER' | 'MINING' | 'GRANARY';


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
    role: SettlementRole; // New Role Property

    // Workforce
    jobCap: number;
    workingPop: number;
    availableVillagers: number; // Idle villagers ready to be deployed
    unreachableHexes?: Record<string, number>; // hexId -> expiryTick

    // UI/AI State fields
    controlledHexIds: string[]; // Hexes this city owns/works
    buildings: BuildingInstance[];

    // Stats
    resourceChange?: Partial<Resources>;

    // AI
    lastGrowth?: number;
    aiState?: {
        surviveMode: boolean; // "General Stand-Down"
        savingFor: 'FLEET' | 'UPGRADE' | null; // "Gold Reserve" / "Material Lock"
        focusResources: string[]; // For HR Governor
        lastDecisions?: Record<string, string[]>; // Governor -> decisions
        lastSettlerSpawnTick?: number;
    };
    popHistory: number[]; // Last 100 ticks of population
    resourceGoals?: Resources; // Target levels for Reactive Ant logic
}

export interface Faction {
    id: string;
    name: string;
    color: string;
    type?: 'Player' | 'AI'; // Add type
    gold?: number; // Global gold? Or per settlement? Let's keep it here for now if needed.
    blackboard?: FactionBlackboard;
    jobPool?: any; // JobPool instance
    aiConfig?: any; // Store per-faction genome for Gladiator mode
}

export type DesireType =
    | 'UPGRADE'
    | 'SETTLER'
    | 'BUILD_FISHERY'
    | 'BUILD_GRANARY'
    | 'BUILD_SMITHY'
    | 'BUILD_LUMBERYARD'
    | 'BUILD_MINE'
    | 'RECRUIT_VILLAGER'
    | 'REQUEST_FREIGHT'
    | 'REPLENISH'
    | 'TRANSFER'
    | 'TRADE_CARAVAN';

export interface DesireTicket {
    settlementId: string;
    type: DesireType;
    score: number; // 0.0 to 1.0
    needs: string[]; // Resource names
}

export interface FactionBlackboard {
    factionId: string;
    stances: {
        expand: number; // 0.0 to 1.0
        exploit: number; // 0.0 to 1.0
    };
    criticalShortages: ResourceType[];
    targetedHexes: string[];
    desires?: DesireTicket[];
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
    lastHexId?: string;    // For stuck detection
    stuckTicks?: number;  // For stuck detection
    jobId?: string; // Assigned Job ID
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
    destinationId?: string; // Hex where the settler intends to found
}

export interface VillagerAgent extends BaseAgent {
    type: 'Villager';
    homeId: string; // Villagers always belong to a settlement
    mission?: 'GATHER' | 'IDLE' | 'INTERNAL_FREIGHT' | 'BUILD';
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
