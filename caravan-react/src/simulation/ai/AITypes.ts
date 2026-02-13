import { BuildingType } from '../../types/WorldTypes.ts';

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



export interface AIStrategy {
    evaluate(state: any, config: any, factionId: string, settlementId: string): AIAction[];
}
