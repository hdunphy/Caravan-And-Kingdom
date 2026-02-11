import * as fs from 'fs';
import { GameConfig } from '../../types/GameConfig';
import { Genome, configToGenome } from './Genome';

export class SeedManager {
    static getSeed(defaultConfig: GameConfig): Genome {
        try {
            // Try to load the best known config from previous runs
            if (fs.existsSync('optimized-config-run-2.json')) {
                const data = fs.readFileSync('optimized-config-run-2.json', 'utf8');
                const config = JSON.parse(data);
                console.log("Seeding population with optimized-config-run-2.json");
                return configToGenome(config);
            }
        } catch (e) {
            console.warn("Failed to load seed config, using default.");
        }
        return configToGenome(defaultConfig);
    }
}
