import { Evolver } from './Evolver';
import { genomeToConfig } from './Genome';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import * as fs from 'fs';

const POP_SIZE = 20;
const options = {
    ticks: 5000,
    width: 50,
    height: 50,
    factionCount: 2
};
const GENERATIONS = 10;

console.log("Starting Evolution...");
console.log(`Map: ${options.width}x${options.height}, Factions: ${options.factionCount}`);

const evolver = new Evolver(POP_SIZE);

for (let g = 0; g < GENERATIONS; g++) {
    const best = evolver.runGeneration(options);
    console.log(`Gen ${g} | Top Fitness: ${best.fitness.toFixed(2)}`);
}

const finalBest = evolver.population[0];
const finalConfig = genomeToConfig(finalBest.genome, DEFAULT_CONFIG);

console.log("=== Optimized Utility Weights ===");
console.log(JSON.stringify(finalConfig.ai.utility, null, 2));

// Save to a file for review
fs.writeFileSync('optimized-config.json', JSON.stringify(finalConfig, null, 2));
console.log("Saved best config to optimized-config.json");
