import { HexCoordinate, Resources } from './WorldTypes';

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
