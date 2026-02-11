import { Evolver } from './Evolver';
import { genomeToConfig } from './Genome';
import { HeadlessRunner } from './HeadlessRunner';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import * as fs from 'fs';
import { Genome } from './Genome';

// Get args from command line
const args = process.argv.slice(2);
const runId = args[0] || '1';
const numGenerations = parseInt(args[1]) || 200;
const numTicks = parseInt(args[2]) || 20000;
const seedFile = args[3];
const outputFile = args[4] ?? `optimized-config-batch4-run-${runId}.json`;

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

let seedConfig = undefined;
if (seedFile && fs.existsSync(seedFile)) {
    console.log(`Loading seed from ${seedFile}...`);
    const data = fs.readFileSync(seedFile, 'utf8');
    seedConfig = JSON.parse(data);
}

const evolver = new Evolver(POP_SIZE, seedConfig);

for (let g = 0; g < numGenerations; g++) {
    // Heartbeat callback
    const onProgress = (percent: number) => {
        // Overwrite line to prevent spam? Simple log for now.
        // process.stdout.write(`\r[Gen ${g+1}] Agent 1 Evaluation: ${percent}%...`);
        // Use standard log for safety if \r is flaky in some terminals
        // console.log(`[Gen ${g+1}] Agent 1 Evaluation: ${percent}%...`);
    };

    // Run Generation
    const best = evolver.runGeneration(options, (p) => {
        if (p % 20 === 0) process.stdout.write(`.`); // Compact heartbeat
    });
    process.stdout.write('\n'); // Newline after progress dots

    // --- State of the Realm Summary ---
    // Reprocess the best individual to get fresh stats for display
    // (We could cache this in Evolver, but re-running is safer for "Display" purposes if we want full state)
    // Actually, Evolver doesn't expose the *state* of the best run, only fitness.
    // For the summary, we'll re-run the best config quickly or just trust the fitness? 
    // User wants "Median Pop, Peak Gold, Tiers Reached". 
    // We already calculated these in FitnessEvaluator but threw them away. 
    // Let's just re-run the best config one last time for the summary log.
    // It costs one extra simulation per generation, which is negligible (20,000 ticks is fast in headless).

    const bestConfig = genomeToConfig(best.genome, DEFAULT_CONFIG);
    const result = HeadlessRunner.run(bestConfig, { ...options, factionCount: 3 }); // Ensure consistent viewing

    const s = result.stats;
    const state = result.state;
    const survivors = Object.keys(state.settlements).length;
    const deaths = s.totalFactions - Object.keys(state.factions).filter(f => Object.values(state.settlements).some(set => set.ownerId === f)).length;
    // Wait, "deaths" is tricky. Faction dies if it has no settlements.

    const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
    const sortedPop = [...s.popHistory].sort((a, b) => a - b);
    const medianPop = sortedPop.length > 0 ? sortedPop[Math.floor(sortedPop.length / 2)] : 0;

    console.log(`\n=== State of the Realm (Gen ${g + 1}) ===`);
    console.table({
        'Best Fitness': best.fitness.toFixed(2),
        'Median Pop': medianPop,
        'Total Gold': Math.floor(totalGold),
        'Max Tier': s.tiersReached,
        'Survivors': survivors,
        'Ticks': s.totalTicks
    });

    // Genome Highlights (Top 3 Genes)
    const geneKeys = Object.keys(best.genome) as (keyof Genome)[];
    const topGenes = geneKeys
        .map(k => ({ key: k, val: best.genome[k] }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 3);

    console.log(`Top Genes: ${topGenes.map(g => `${g.key}=${g.val.toFixed(2)}`).join(', ')}`);
}

const finalBest = evolver.population[0];
const finalConfig = genomeToConfig(finalBest.genome, DEFAULT_CONFIG);

fs.writeFileSync(outputFile, JSON.stringify(finalConfig, null, 2));
console.log(`\nRun ${runId} Complete. Saved apex config to ${outputFile}`);
