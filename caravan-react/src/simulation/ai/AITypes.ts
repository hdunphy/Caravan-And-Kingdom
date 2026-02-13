import { BuildingType, ResourceType } from '../../types/WorldTypes';

export type AIActionType =
    | 'BUILD'
    | 'DISPATCH_CARAVAN'
    | 'RECRUIT_VILLAGER'
    | 'DISPATCH_VILLAGER'
    | 'UPGRADE_SETTLEMENT'
    | 'SPAWN_SETTLER'
    | 'BUILD_CARAVAN';

export interface AIAction {
    type: AIActionType;
    settlementId: string;
    score: number;
    targetHexId?: string; // For dispatch/build
    buildingType?: BuildingType; // For construction
    mission?: 'TRADE' | 'LOGISTICS' | 'GATHER' | 'INTERNAL_FREIGHT'; // For caravans/villagers
    context?: any; // Extra data (e.g. which resource to buy)
    payload?: any; // For villagers
}

export type JobType = 'COLLECT' | 'BUILD' | 'RECRUIT' | 'EXPAND' | 'TRADE' | 'TRANSFER';
export type JobUrgency = 'HIGH' | 'MEDIUM' | 'LOW';
export type JobStatus = 'OPEN' | 'SATURATED' | 'COMPLETED';

export interface JobTicket {
    jobId: string;
    factionId: string;
    sourceId: string; // Settlement requesting the job
    type: JobType;
    urgency: JobUrgency;
    priority: number;
    targetHexId?: string; // Optional for multi-source jobs
    resource?: ResourceType;
    targetVolume: number; // e.g. 500 units total
    assignedVolume: number; // Current worker commitment
    status: JobStatus;
}

export interface AIStrategy {
    evaluate(state: any, config: any, factionId: string, settlementId: string): AIAction[];
}
