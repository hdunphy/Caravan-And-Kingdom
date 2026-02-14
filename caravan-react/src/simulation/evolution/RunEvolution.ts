import { Evolver } from './Evolver';
import { genomeToConfig } from './Genome';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import * as fs from 'fs';
import { Genome } from './Genome';
import { Logger } from '../../utils/Logger';

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

Logger.getInstance().log(`\n=== Starting Evolution Run #${runId} ===`);
Logger.getInstance().log(`Generations: ${numGenerations}, Ticks: ${numTicks}`);
Logger.getInstance().log(`Map: ${options.width}x${options.height}, Factions (per match): 3`);

let seedConfig = undefined;
if (seedFile && fs.existsSync(seedFile)) {
    Logger.getInstance().log(`Loading seed from ${seedFile}...`);
    const data = fs.readFileSync(seedFile, 'utf8');
    seedConfig = JSON.parse(data);
}

if (seedConfig == undefined || seedConfig == null) {
    Logger.getInstance().log(`No seed config found. Using default config.`);
    seedConfig = DEFAULT_CONFIG;
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
        const s = best.stats;

        if (!s) {
            console.error("Error: Best individual missing stats!");
            continue;
        }

        const fStats = Object.values(s.factions)[0];
        const survivors = Object.keys(s.factions).filter(k => s.factions[k].population > 0).length;
        const villageCount = (fStats.settlementsFounded || 0) + 1;
        const density = fStats.population / villageCount;

        // Find most traded resource
        let topRes = 'None';
        let topAmt = 0;
        if (fStats.tradeResources) {
            Object.entries(fStats.tradeResources).forEach(([res, amt]) => {
                const val = amt as number;
                if (val > topAmt) {
                    topAmt = val;
                    topRes = res;
                }
            });
        }

        Logger.getInstance().setSilent(false);
        Logger.getInstance().log(`\n=== State of the Realm (Gen ${g + 1}) ===`);
        Logger.getInstance().log(`Fitness: ${best.fitness.toFixed(2)} | Pop: ${fStats.population.toFixed(1)} | Gold: ${Math.floor(fStats.totalWealth)}`);
        Logger.getInstance().log(`Villages: ${villageCount} | Density: ${density.toFixed(2)} | Settlers: ${fStats.settlersSpawned} | Villagers: ${fStats.totalVillagers}`);
        Logger.getInstance().log(`Trades: ${fStats.totalTrades} | TopTrade: ${topRes} | MaxCaravans: ${fStats.maxCaravans}`);
        Logger.getInstance().log(`Waste: ${Math.floor(fStats.resourceWaste || 0)} | Max Tier: ${fStats.tiersReached} | Survivors: ${survivors}`);

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
