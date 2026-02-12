import { BuildingType } from '../../types/WorldTypes';

export type AIAction = { score: number } & (
    | { type: 'BUILD', settlementId: string, buildingType: BuildingType, hexId: string }
    | { type: 'DISPATCH_CARAVAN', settlementId: string, targetHexId: string, mission: 'TRADE' | 'LOGISTICS', context: any }
    | { type: 'RECRUIT_VILLAGER', settlementId: string }
    | { type: 'DISPATCH_VILLAGER', settlementId: string, targetHexId: string, mission?: 'GATHER' | 'INTERNAL_FREIGHT', payload?: any }
    | { type: 'UPGRADE_SETTLEMENT', settlementId: string }
    | { type: 'SPAWN_SETTLER', settlementId: string, targetHexId: string, context?: any }
    | { type: 'BUILD_CARAVAN', settlementId: string }
);

export interface AIStrategy {
    evaluate(state: any, config: any, factionId: string, settlementId?: string): AIAction[];
}
