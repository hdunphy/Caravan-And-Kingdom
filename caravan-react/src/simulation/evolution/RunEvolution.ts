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
    factionConfigs: [], // Will be populated by Evolver
    useWorker: true
};

import { Logger } from '../../utils/Logger';

// ...
Logger.getInstance().log(`\n=== Starting Evolution Run #${runId} ===`);
Logger.getInstance().log(`Generations: ${numGenerations}, Ticks: ${numTicks}`);
Logger.getInstance().log(`Map: ${options.width}x${options.height}, Factions (per match): 3`);

let seedConfig = undefined;
if (seedFile && fs.existsSync(seedFile)) {
    Logger.getInstance().log(`Loading seed from ${seedFile}...`);
    const data = fs.readFileSync(seedFile, 'utf8');
    seedConfig = JSON.parse(data);
}

const evolver = new Evolver(POP_SIZE, seedConfig);

(async () => {
    for (let g = 0; g < numGenerations; g++) {
        // Heartbeat callback
        const onProgress = (percent: number) => {
            // Overwrite line to prevent spam? Simple log for now.
            if (percent % 10 === 0) process.stdout.write(`.`);
        };

        // Run Generation
        const best = await evolver.runGeneration(options, onProgress);
        process.stdout.write('\n'); // Newline after progress dots

        // --- State of the Realm Summary ---
        // We now get full stats/state from the worker!
        // But 'best' is an Individual, which has 'stats' (SimulationStats)
        const s = best.stats;

        // We need the stats for the specific faction that WON (or was best)
        // usage: best.fitness was calculated from a specific faction.
        // We don't strictly know WHICH faction ID corresponds to 'best' unless we tracked it.
        // However, we know 'best' was evaluated as 'player_1' or 'rival_X'.
        // Actually, in Evolver, we assign: `this.population[popIndex].fitness = fitness`
        // We didn't store WHICH faction ID it was.
        // But for display, we can just show the stats of 'player_1' from the run that produced 'best'?
        // Wait, 'best.stats' is the SimulationStats of the MATCH where this individual participated.
        // And we don't know which faction key it was.
        // FIX: In Evolver.ts, we should probably store the factionID on the individual too?
        // Or just search stats.factions for the one with matching fitness? (Risk of collision)
        // or just show Player 1 stats if we assume sorted?
        // Let's iterate factions and find the one with highest fitness/score?

        if (!s) {
            console.error("Error: Best individual missing stats!");
            continue;
        }

        // Find the faction stat that matches the best fitness? 
        // Or just print the best performing faction in that run?
        let bestFactionId = 'player_1';
        // For now, let's just grab the first one or player_1 as a proxy.
        // In the future, Evolver should track this.

        const fStats = s.factions[bestFactionId] || Object.values(s.factions)[0];
        const survivors = Object.keys(s.factions).filter(k => s.factions[k].population > 0).length;

        Logger.getInstance().setSilent(false);
        Logger.getInstance().log(`\n=== State of the Realm (Gen ${g + 1}) ===`);
        console.table({
            'Best Fitness': best.fitness.toFixed(2),
            'Pop': fStats.population,
            'Wealth': Math.floor(fStats.totalWealth),
            'Max Tier': fStats.tiersReached,
            'Goals': Object.keys(fStats.goalsCompleted).length,
            'Survivors': survivors,
            'Ticks': s.totalTicks
        });

        // Genome Highlights (Top 3 Genes)
        const geneKeys = Object.keys(best.genome) as (keyof Genome)[];
        const topGenes = geneKeys
            .map(k => ({ key: k, val: best.genome[k] }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 3);

        Logger.getInstance().log(`Top Genes: ${topGenes.map(g => `${g.key}=${g.val.toFixed(2)}`).join(', ')}`);
    }

    const finalBest = evolver.population[0];
    const finalConfig = genomeToConfig(finalBest.genome, DEFAULT_CONFIG);

    fs.writeFileSync(outputFile, JSON.stringify(finalConfig, null, 2));
    Logger.getInstance().log(`\nRun ${runId} Complete. Saved apex config to ${outputFile}`);
})();
