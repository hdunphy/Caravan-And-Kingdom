import { Faction, WorldState, Resources } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';
import { JobTicket, JobUrgency } from './AITypes';
import { JobPool } from './JobPool';

export class GOAPPlanner {
    static plan(faction: Faction, jobPool: JobPool, state: WorldState, config: GameConfig) {
        if (!faction.blackboard || !faction.blackboard.desires) return;

        const desires = faction.blackboard.desires;

        // Group desires by settlement to aggregate needs locally
        const settlementDesires = new Map<string, typeof desires>();
        desires.forEach(d => {
            if (!settlementDesires.has(d.settlementId)) settlementDesires.set(d.settlementId, []);
            settlementDesires.get(d.settlementId)!.push(d);
        });

        settlementDesires.forEach((settlementDesires, settlementId) => {
            const settlement = state.settlements[settlementId];
            if (!settlement) return;

            const resourceDemands = new Map<keyof Resources, { amount: number, priority: number }>();

            // Pass 1: Aggregate Needs from Desires
            settlementDesires.forEach(desire => {
                const costs = this.getDesireCosts(desire, settlement, config);

                // Aggregate Resource Needs
                Object.entries(costs).forEach(([res, amount]) => {
                    const r = res as keyof Resources;
                    if (!resourceDemands.has(r)) {
                        resourceDemands.set(r, { amount: 0, priority: 0 });
                    }
                    const demand = resourceDemands.get(r)!;
                    // For REPLENISH, we use the amount as a target, not additive
                    if (desire.type === 'REPLENISH') {
                        demand.amount = Math.max(demand.amount, (amount as number));
                    } else {
                        demand.amount += (amount as number);
                    }
                    demand.priority += desire.score; // SUMMING PRIORITY
                });

                // Work Jobs (Build/Upgrade/Trade)
                switch (desire.type) {
                    /*
                    case 'BUILD_SMITHY':
                    case 'BUILD_GRANARY':
                    case 'BUILD_FISHERY':
                    case 'BUILD_LUMBERYARD':
                    case 'BUILD_MINE':
                        // UPGRADE handles internally as Instant Action in AIController
                        // If sufficient resources (for specific desire), create Work Job
                        if (this.hasSufficientResources(settlement, costs)) {
                             this.createWorkJob(faction, settlement, jobPool, desire, config);
                        }
                        break;
                    */

                    case 'TRADE_CARAVAN':
                        this.createTradeJob(faction, settlement, jobPool, state, config, desire.score);
                        break;

                    case 'REQUEST_FREIGHT':
                        this.createTransferJob(faction, settlement, jobPool, state, config, desire);
                        break;
                }
            });

            // Pass 2: Create COLLECT Jobs for aggregated deficits
            resourceDemands.forEach((demand, res) => {
                const currentStock = settlement.stockpile[res] || 0;
                const deficit = demand.amount - currentStock;

                if (deficit > 0) {
                    const jobId = `${faction.id}-${settlement.id}-COLLECT-${res}`;
                    this.postJob(jobPool, {
                        jobId,
                        factionId: faction.id,
                        sourceId: settlement.id,
                        type: 'COLLECT',
                        resource: res,
                        urgency: this.calculateUrgency(demand.priority),
                        priority: demand.priority, // Use Summed Priority
                        targetVolume: deficit,
                        assignedVolume: 0,
                        status: 'OPEN'
                    });
                }
            });
        });

        jobPool.cleanup();
    }

    private static getDesireCosts(desire: any, settlement: any, config: GameConfig): Partial<Resources> {
        switch (desire.type) {
            case 'UPGRADE':
                const nextTier = settlement.tier + 1;
                const upgradeConfig = (nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity);

                // Map config keys (costTimber) to Resource keys (Timber)
                const costs: Partial<Resources> = {};
                if ('costTimber' in upgradeConfig) costs.Timber = (upgradeConfig as any).costTimber;
                if ('costStone' in upgradeConfig) costs.Stone = (upgradeConfig as any).costStone;
                if ('costOre' in upgradeConfig) costs.Ore = (upgradeConfig as any).costOre;

                return costs;

            case 'REPLENISH':
                const res = desire.needs[0] as keyof Resources;
                const goal = settlement.resourceGoals?.[res] || 100;
                // Return the TARGET STOCK level, not the deficit.
                // The deficit is calculated in Pass 2 by subtracting current stock.
                return { [res]: goal };
            case 'RECRUIT_VILLAGER':
                return config.costs.agents.Villager as Partial<Resources>;
            case 'SETTLER':
                return config.costs.agents.Settler as Partial<Resources>;
            case 'REQUEST_FREIGHT':
                // For REQUEST_FREIGHT, the "cost" is actually the target amount we want to reach.
                // We map the needs list to the deficit.
                const needs: Partial<Resources> = {};
                if (desire.needs) {
                    desire.needs.forEach((res: string) => {
                        const r = res as keyof Resources;
                        const goal = settlement.resourceGoals ? settlement.resourceGoals[r] : 0;
                        needs[r] = goal;
                    });
                }
                return needs;
            case 'BUILD_SMITHY':
            case 'BUILD_GRANARY':
            case 'BUILD_FISHERY':
            case 'BUILD_LUMBERYARD':
            case 'BUILD_MINE':
                return this.getBuildingCost(desire.type.replace('BUILD_', ''), config);
            default:
                return {};
        }
    }

    private static hasSufficientResources(settlement: any, cost: Partial<Resources>): boolean {
        for (const [res, amount] of Object.entries(cost)) {
            if ((settlement.stockpile[res] || 0) < (amount as number)) return false;
        }
        return true;
    }

    private static createWorkJob(
        faction: Faction,
        settlement: any,
        jobPool: JobPool,
        desire: any,
        _config: GameConfig
    ) {
        const jobId = `${faction.id}-${desire.settlementId}-${desire.type}-WORK`;

        this.postJob(jobPool, {
            jobId,
            factionId: faction.id,
            sourceId: settlement.id,
            type: 'BUILD',
            urgency: this.calculateUrgency(desire.score),
            priority: desire.score,
            targetVolume: 100, // Fixed work amount
            assignedVolume: 0,
            status: 'OPEN',
            targetHexId: settlement.hexId
        });
    }

    private static createTradeJob(
        faction: Faction,
        settlement: any,
        jobPool: JobPool,
        _state: WorldState,
        _config: GameConfig,
        priority: number
    ) {
        const jobId = `${faction.id}-${settlement.id}-TRADE-GENERIC`;
        this.postJob(jobPool, {
            jobId,
            factionId: faction.id,
            sourceId: settlement.id,
            type: 'TRADE',
            urgency: this.calculateUrgency(priority),
            priority: priority,
            targetVolume: 1, // 1 Trip
            assignedVolume: 0,
            status: 'OPEN'
        });
    }

    private static createTransferJob(
        faction: Faction,
        targetSettlement: any,
        jobPool: JobPool,
        state: WorldState,
        _config: GameConfig,
        desire: any
    ) {
        const res = desire.needs[0] as keyof Resources;

        // Find Donor
        const donor = Object.values(state.settlements).find(s => {
            if (s.id === targetSettlement.id || s.ownerId !== faction.id) return false;
            const goal = s.resourceGoals?.[res] || 100;
            return (s.stockpile[res] || 0) > goal * 1.5; // Threshold for surplus
        });

        if (donor) {
            const amount = Math.min(
                (donor.stockpile[res] || 0) - (donor.resourceGoals?.[res] || 100),
                (targetSettlement.resourceGoals?.[res] || 500) - (targetSettlement.stockpile[res] || 0)
            );

            if (amount > 0) {
                const jobId = `${faction.id}-${donor.id}-TRANSFER-${targetSettlement.id}-${res}`;
                this.postJob(jobPool, {
                    jobId,
                    factionId: faction.id,
                    sourceId: donor.id,
                    type: 'TRANSFER',
                    resource: res,
                    urgency: this.calculateUrgency(desire.score),
                    priority: desire.score,
                    targetVolume: amount,
                    assignedVolume: 0,
                    status: 'OPEN',
                    targetHexId: targetSettlement.hexId
                });
            }
        }
    }

    private static postJob(jobPool: JobPool, ticket: JobTicket) {
        const existing = jobPool.getJob(ticket.jobId);
        if (existing) {
            ticket.assignedVolume = existing.assignedVolume;
            ticket.status = existing.status;
            // Update priority/urgency/volume
            ticket.priority = ticket.priority; // already set in ticket object
        }
        jobPool.addJob(ticket);
    }

    private static calculateUrgency(score: number): JobUrgency {
        if (score > 0.8) return 'HIGH';
        if (score > 0.5) return 'MEDIUM';
        return 'LOW';
    }

    private static getBuildingCost(type: string, _config: GameConfig): any {
        switch (type) {
            case 'SMITHY': return { Timber: 100, Stone: 50 };
            case 'GRANARY': return { Timber: 100, Stone: 20 };
            case 'FISHERY': return { Timber: 80 };
            case 'LUMBERYARD': return { Timber: 50 };
            case 'MINE': return { Timber: 100 };
            default: return { Timber: 50 };
        }
    }
}
