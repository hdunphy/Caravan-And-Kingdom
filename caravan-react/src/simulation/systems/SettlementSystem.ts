import { WorldState, Settlement, SettlementRole } from '../../types/WorldTypes.ts';
import { GameConfig } from '../../types/GameConfig.ts';

export const SettlementSystem = {
    update(state: WorldState, config: GameConfig) {
        // Run role updates periodically
        // We can use a modulo check on state.tick
        // Use config.feudal.roleCheckInterval?

        const interval = config.ai?.feudal?.roleCheckInterval || 100;
        if (state.tick % interval === 0) {
            this.updateRoles(state, config);
        }
    },

    updateRoles(state: WorldState, config?: GameConfig) {
        // Config might be optional for tests if not passed
        // but real usage should pass it.
        // Fallback default thresholds
        const tForest = config?.ai?.feudal?.thresholds?.lumberForestRatio || 0.3;
        const tHills = config?.ai?.feudal?.thresholds?.miningHillRatio || 0.3;
        const tPlains = config?.ai?.feudal?.thresholds?.granaryPlainsRatio || 0.5;

        Object.values(state.settlements).forEach(settlement => {
            this.evaluateRole(state, settlement, tForest, tHills, tPlains);
        });
    },

    evaluateRole(state: WorldState, settlement: Settlement, tForest: number, tHills: number, tPlains: number) {
        const hexIds = settlement.controlledHexIds;
        if (hexIds.length === 0) return;

        let forestCount = 0;
        let hillsCount = 0; // Hills or Mountains? Usually Hills/Mountains provide Ore/Stone
        let plainsCount = 0;
        let total = 0;

        hexIds.forEach(id => {
            const hex = state.map[id];
            if (!hex) return;
            total++;
            if (hex.terrain === 'Forest') forestCount++;
            else if (hex.terrain === 'Hills' || hex.terrain === 'Mountains') hillsCount++;
            else if (hex.terrain === 'Plains') plainsCount++;
        });

        if (total === 0) return;

        // Priority Logic:
        // If > 30% Forest -> LUMBER
        // Else If > 30% Hills -> MINING
        // Else If > 50% Plains -> GRANARY
        // Else -> GENERAL

        // "Lumber, Mining, or Granary"
        // What if multiple match?
        // Let's assume hierarchy: Lumber > Mining > Granary?
        // Or pick highest ratio?
        // Let's stick to the prompt's implied simple checks.

        const fRatio = forestCount / total;
        const hRatio = hillsCount / total;
        const pRatio = plainsCount / total;

        let newRole: SettlementRole = 'GENERAL';

        if (fRatio >= tForest) {
            newRole = 'LUMBER';
        } else if (hRatio >= tHills) {
            newRole = 'MINING';
        } else if (pRatio >= tPlains) {
            newRole = 'GRANARY';
        }

        if (settlement.role !== newRole) {
            settlement.role = newRole;
            // console.log(`[Feudal] ${settlement.name} assigned role: ${newRole}`);
        }
    }
};
