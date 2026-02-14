import { ResourceType } from '../../types/WorldTypes';

export type ActionType = 'GATHER' | 'FREIGHT' | 'TRADE';

export interface GOAPAction {
    name: ActionType;
    cost: number; // AP/Time cost
    conditions: {
        resource?: ResourceType;
        [key: string]: any;
    };
    effects: {
        [key: string]: any;
    };
}

export class GOAPActions {
    static get actions(): GOAPAction[] {
        return [
            {
                name: 'GATHER',
                cost: 10,
                conditions: {},
                effects: { addResource: true }
            },
            {
                name: 'FREIGHT',
                cost: 20,
                conditions: { sourceHasSurplus: true },
                effects: { moveResource: true }
            },
            {
                name: 'TRADE',
                cost: 30,
                conditions: { targetHasSurplus: true, goldAvailable: true },
                effects: { buyResource: true }
            }
        ];
    }
}
