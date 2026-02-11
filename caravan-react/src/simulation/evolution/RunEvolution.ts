import { Evolver } from './Evolver';
import { genomeToConfig } from './Genome';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import * as fs from 'fs';

// Get args from command line
const args = process.argv.slice(2);
const runId = args[0] || '1';
const numGenerations = parseInt(args[1]) || 200;
const numTicks = parseInt(args[2]) || 20000;
const outputFile = `optimized-config-batch2-run-${runId}.json`;

const POP_SIZE = 50; // Increased population for better diversity
const options = {
    ticks: numTicks,
    width: 40,
    height: 40,
    factionCount: 3 // More factions for competitive pressure
};

console.log(`\n=== Starting Evolution Run #${runId} ===`);
console.log(`Generations: ${numGenerations}, Ticks: ${numTicks}`);
console.log(`Map: ${options.width}x${options.height}, Factions: ${options.factionCount}`);

const evolver = new Evolver(POP_SIZE);

for (let g = 0; g < numGenerations; g++) {
    const best = evolver.runGeneration(options);
    if (g % 10 === 0 || g === numGenerations - 1) {
        console.log(`Run ${runId} | Gen ${g} | Best Fitness: ${best.fitness.toFixed(2)}`);
    }
}

const finalBest = evolver.population[0];
const finalConfig = genomeToConfig(finalBest.genome, DEFAULT_CONFIG);

fs.writeFileSync(outputFile, JSON.stringify(finalConfig, null, 2));
console.log(`\nRun ${runId} Complete. Saved apex config to ${outputFile}`);
