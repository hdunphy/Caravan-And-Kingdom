import { BuildingType } from '../../types/WorldTypes';

export type AIAction =
    | { type: 'BUILD', settlementId: string, buildingType: BuildingType, hexId: string }
    | { type: 'DISPATCH_CARAVAN', settlementId: string, targetHexId: string, mission: 'TRADE' | 'LOGISTICS', context: any }
    | { type: 'RECRUIT_VILLAGER', settlementId: string }
    | { type: 'DISPATCH_VILLAGER', settlementId: string, targetHexId: string }
    | { type: 'UPGRADE_SETTLEMENT', settlementId: string };

export interface AIStrategy {
    evaluate(state: any, config: any, factionId: string): AIAction[];
}
