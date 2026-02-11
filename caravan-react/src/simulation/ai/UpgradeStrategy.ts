import { AIAction, AIStrategy } from './AITypes';
import { WorldState } from '../../types/WorldTypes';
import { GameConfig } from '../../types/GameConfig';

export class UpgradeStrategy implements AIStrategy {
    evaluate(state: WorldState, config: GameConfig, factionId: string): AIAction[] {
        const actions: AIAction[] = [];
        const factionSettlements = Object.values(state.settlements).filter(s => s.ownerId === factionId);

        factionSettlements.forEach(settlement => {
            // ==========================================
            // DESIRE 4: ASCEND (Tech/Tier Upgrade)
            // ==========================================

            // Check if max tier?
            if (settlement.tier >= 2) return;

            let reqMet = true;
            let cost: any;

            if (settlement.tier === 0) {
                cost = config.upgrades.villageToTown;
                if (settlement.population < cost.population) reqMet = false;
                if (settlement.stockpile.Timber < cost.costTimber) reqMet = false;
                if (settlement.stockpile.Stone < cost.costStone) reqMet = false;
            } else if (settlement.tier === 1) {
                cost = config.upgrades.townToCity;
                if (settlement.population < cost.population) reqMet = false;
                if (settlement.stockpile.Timber < cost.costTimber) reqMet = false;
                if (settlement.stockpile.Stone < cost.costStone) reqMet = false;
                if (settlement.stockpile.Ore < cost.costOre) reqMet = false;
            }

            if (reqMet) {
                // Readiness: How close are we to population cap?
                // Formula: (Pop / CurrentCap) ^ Power

                const readinessPower = config.ai?.utility?.ascendReadinessPower || 2.0;
                const reqPop = cost.population;

                const score = Math.pow(settlement.population / reqPop, readinessPower);

                // If we have resources, and population is high, Upgrade!
                if (score > 0.5) {
                    actions.push({
                        type: 'UPGRADE_SETTLEMENT',
                        settlementId: settlement.id,
                        score: score
                    });
                }
            }
        });

        return actions;
    }
}
