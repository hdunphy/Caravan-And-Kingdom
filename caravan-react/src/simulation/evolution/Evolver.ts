import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Genome, genomeToConfig, configToGenome } from './Genome';
import { HeadlessOptions, SimulationStats, HeadlessRunner } from './HeadlessRunner';
import { calculateFitness } from './FitnessEvaluator';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import { GameConfig } from '../../types/GameConfig';
import { WorldState } from '../../types/WorldTypes';
import * as os from 'os';
import { Logger } from '../../utils/Logger';

export interface Individual {
    genome: Genome;
    fitness: number;
    stats?: SimulationStats;
    state?: WorldState;
}

export class Evolver {
    population: Individual[] = [];
    generation: number = 0;
    private poolSize: number;
    private useWorker: boolean = false;

    constructor(size: number, seedConfig?: GameConfig) {
        this.poolSize = Math.max(1, os.cpus().length - 1);

        let seedGenome: Genome;

        if (seedConfig) {
            seedGenome = configToGenome(seedConfig);
            Logger.getInstance().log("Seeding population with provided config.");
        } else {
            seedGenome = configToGenome(DEFAULT_CONFIG);
        }

        for (let i = 0; i < size; i++) {
            // Mix: 20% pure seed, 80% mutated seed
            const genome = i < (size * 0.2) ? seedGenome : this.mutate(seedGenome, 0.5);
            this.population.push({
                genome: genome,
                fitness: 0
            });
        }
    }

    private getWorkerPath(): string {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        return path.join(__dirname, 'EvolutionWorker.ts');
    }


    private mutate(genome: Genome, amount: number): Genome {
        const newGenome = { ...genome };
        const keys = Object.keys(newGenome) as (keyof Genome)[];

        keys.forEach(key => {
            if (Math.random() < 0.3) { // 30% chance to mutate each gene
                const change = 1 + (Math.random() * 2 - 1) * amount;
                (newGenome[key] as any) *= change;
            }
        });

        return newGenome;
    }

    async runGeneration(options: HeadlessOptions, onProgress?: (percent: number) => void): Promise<Individual> {
        this.generation++;

        // Calculate mutation amount based on "cooling" schedule
        const maxGenerations = 200;
        const coolingFactor = Math.max(0.1, 1.0 - (this.generation / maxGenerations));
        const currentMutationAmount = 0.5 * coolingFactor;

        // 1. Evaluate
        // Fallback to sequential for stability if workers fail or poolSize is 1
        // Tests should set useWorker: false to avoid TS-Node worker issues
        const useParallel = options.useWorker !== undefined ? options.useWorker : this.useWorker;

        if (useParallel) {
            Logger.getInstance().log(`[Gen ${this.generation}] Spawning ${this.poolSize} workers for ${this.population.length} individuals...`);
            try {
                await this.evaluatePopulationParallel(options, onProgress);
            } catch (err) {
                Logger.getInstance().log(`[Evolver] Parallel evaluation failed, falling back to sequential: ${err}`);
                this.evaluatePopulationSequential(options, onProgress);
            }
        } else {
            Logger.getInstance().log(`[Gen ${this.generation}] Running sequential evaluation...`);
            this.evaluatePopulationSequential(options, onProgress);
        }

        // 2. Sort by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);

        const best = this.population[0];
        if (this.generation % 10 === 0) {
            Logger.getInstance().log(`Generation ${this.generation} Best Fitness: ${best.fitness.toFixed(2)} | Mutation Level: ${currentMutationAmount.toFixed(2)}`);
        }

        // 3. Selection (Keep top 10% elite)
        const eliteSize = Math.ceil(this.population.length * 0.1);
        const elite = this.population.slice(0, eliteSize);
        const newPopulation: Individual[] = [...elite];

        // 4. Repopulate using Crossover and Mutation
        while (newPopulation.length < this.population.length) {
            const parentPool = this.population.slice(0, Math.ceil(this.population.length * 0.5));
            const p1 = parentPool[Math.floor(Math.random() * parentPool.length)];
            const p2 = parentPool[Math.floor(Math.random() * parentPool.length)];

            const childGenome = this.crossover(p1.genome, p2.genome);
            const mutatedGenome = this.mutate(childGenome, currentMutationAmount);

            newPopulation.push({
                genome: mutatedGenome,
                fitness: 0
            });
        }

        this.population = newPopulation;
        return best;
    }

    private evaluatePopulationSequential(options: HeadlessOptions, onProgress?: (percent: number) => void) {
        // Shuffle population to ensure random matchups
        const shuffledIndices = this.population.map((_, i) => i).sort(() => Math.random() - 0.5);

        // Group into Trios (or custom faction count)
        const factionCount = 3;

        for (let i = 0; i < this.population.length; i += factionCount) {
            const groupIndices = shuffledIndices.slice(i, i + factionCount);
            // If not enough for a full group, wrap around or just run partial? 
            // Logic: Just run partial is fine, or borrow from elite.
            // For simplicity, run partial group.

            if (groupIndices.length === 0) break;

            const groupConfigs = groupIndices.map(idx => genomeToConfig(this.population[idx].genome, DEFAULT_CONFIG));

            const runOptions = {
                ...options,
                factionConfigs: groupConfigs,
                onHeartbeat: i === 0 && onProgress ? onProgress : undefined
            };

            // Clear cache handled inside HeadlessRunner
            const result = HeadlessRunner.run(DEFAULT_CONFIG, runOptions);

            // Assign Fitness
            groupIndices.forEach((popIndex, groupIndex) => {
                const factionId = groupIndex === 0 ? 'player_1' : `rival_${groupIndex}`;
                const fitness = calculateFitness(result.state, result.stats, factionId, this.generation);

                this.population[popIndex].fitness = fitness;
                this.population[popIndex].stats = result.stats;
                // DO NOT store state on individual to prevent memory bloat/serialization issues
                // this.population[popIndex].state = result.state;
            });
        }
    }

    private async evaluatePopulationParallel(options: HeadlessOptions, onProgress?: (percent: number) => void) {
        const workerPath = this.getWorkerPath();

        // 1. Prepare Matches (Trios)
        const shuffledIndices = this.population.map((_, i) => i).sort(() => Math.random() - 0.5);
        const matches: { indices: number[], configs: GameConfig[] }[] = [];
        const factionCount = 3;

        for (let i = 0; i < this.population.length; i += factionCount) {
            const groupIndices = shuffledIndices.slice(i, i + factionCount);
            if (groupIndices.length === 0) break;
            const groupConfigs = groupIndices.map(idx => genomeToConfig(this.population[idx].genome, DEFAULT_CONFIG));
            matches.push({ indices: groupIndices, configs: groupConfigs });
        }

        const totalTasks = matches.length;
        let completed = 0;

        // Create Workers (Child Processes)
        const numWorkers = Math.min(this.poolSize, totalTasks);
        const workers: ChildProcess[] = [];

        return new Promise<void>((resolve, reject) => {
            let pendingMatches = [...matches];
            let activeWorkers = 0;

            const startWorker = () => {
                // tsx patches fork, so we can just run the TS file
                // console.log(`[Evolver] Forking worker: ${workerPath}`);
                const worker = fork(workerPath, [], {
                    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
                });

                workers.push(worker);
                activeWorkers++;

                worker.on('message', (msg: any) => {
                    const { success, results, error } = msg;

                    if (!success) {
                        console.error(`Worker error:`, error);
                    } else {
                        const matchIndices = results.indices as number[];
                        const factionResults = results.factions;

                        matchIndices.forEach((popIndex, i) => {
                            const factionId = i === 0 ? 'player_1' : `rival_${i}`;
                            const fResult = factionResults[factionId];

                            if (fResult && this.population[popIndex]) {
                                this.population[popIndex].fitness = fResult.fitness;
                                this.population[popIndex].stats = results.stats;
                            }
                        });
                    }

                    completed++;
                    if (onProgress) onProgress((completed / totalTasks) * 100);

                    // Pick next
                    if (pendingMatches.length > 0) {
                        const nextMatch = pendingMatches.shift()!;
                        worker.send({
                            indices: nextMatch.indices,
                            factionConfigs: nextMatch.configs,
                            options: options,
                            generation: this.generation
                        });
                    } else {
                        worker.kill();
                        activeWorkers--;
                        if (activeWorkers === 0) {
                            resolve();
                        }
                    }
                });

                worker.on('error', (err: any) => {
                    console.error('Worker crashed:', err);
                    reject(err);
                });

                // Initial Task
                if (pendingMatches.length > 0) {
                    const nextMatch = pendingMatches.shift()!;
                    worker.send({
                        indices: nextMatch.indices,
                        factionConfigs: nextMatch.configs,
                        options: options,
                        generation: this.generation
                    });
                } else {
                    worker.kill();
                    activeWorkers--;
                }
            };

            for (let i = 0; i < numWorkers; i++) {
                startWorker();
            }
        });
    }

    private crossover(g1: Genome, g2: Genome): Genome {
        const child = { ...g1 };
        const keys = Object.keys(child) as (keyof Genome)[];
        keys.forEach(key => {
            if (Math.random() < 0.5) {
                (child[key] as any) = (g2[key] as any);
            }
        });
        return child;
    }
}