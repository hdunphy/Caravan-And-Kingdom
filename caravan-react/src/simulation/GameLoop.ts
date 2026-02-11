import { WorldState } from '../types/WorldTypes';
import { MetabolismSystem } from './systems/MetabolismSystem';
import { ExtractionSystem } from './systems/ExtractionSystem';
import { VillagerSystem } from './systems/VillagerSystem';
import { MovementSystem } from './systems/MovementSystem';
import { CaravanSystem } from './systems/CaravanSystem';

import { GameConfig } from '../types/GameConfig';

import { IndustrySystem } from './systems/IndustrySystem';

import { MaintenanceSystem } from './systems/MaintenanceSystem';
import { UpgradeSystem } from './systems/UpgradeSystem';
import { AIController } from './ai/AIController';

export class GameLoop {
    state: WorldState;
    config: GameConfig;
    aiController: AIController;
    silent: boolean = false;

    constructor(state: WorldState, config: GameConfig, silent: boolean = false) {
        this.state = state;
        this.config = config;
        this.aiController = new AIController();
        this.silent = silent;
    }

    tick() {
        this.state.tick++;

        // Movement always runs (simulation tick)
        MovementSystem.update(this.state, this.config);
        CaravanSystem.update(this.state, this.config, this.silent);

        // Economy runs only on resource intervals
        if (this.state.tick % this.config.simulation.resourceTickInterval === 0) {
            // Snapshot previous resources
            const prevResources: Record<string, any> = {};
            Object.values(this.state.settlements).forEach(s => {
                prevResources[s.id] = { ...s.stockpile };
            });

            // Run Systems
            ExtractionSystem.update(this.state, this.config);
            VillagerSystem.update(this.state, this.config);
            IndustrySystem.update(this.state, this.config);
            MaintenanceSystem.update(this.state, this.config);
            MetabolismSystem.update(this.state, this.config, this.silent);
            UpgradeSystem.update(this.state, this.config, this.silent);
            CaravanSystem.processTrade(this.state, this.config);

            // AI Decisions
            this.aiController.update(this.state, this.config);

            // Calculate Deltas
            Object.values(this.state.settlements).forEach(s => {
                const prev = prevResources[s.id];
                if (prev) {
                    s.resourceChange = {};
                    (Object.keys(s.stockpile) as Array<keyof typeof s.stockpile>).forEach(key => {
                        s.resourceChange![key] = s.stockpile[key] - prev[key];
                    });
                }
            });
        }

        return this.state;
    }

    spawnAgent(startHexId: string, targetHexId: string) {
        return CaravanSystem.spawn(this.state, startHexId, targetHexId);
    }

    forceTrade() {
        CaravanSystem.forceTrade(this.state, this.config);
    }

    getState() {
        return this.state;
    }
}
