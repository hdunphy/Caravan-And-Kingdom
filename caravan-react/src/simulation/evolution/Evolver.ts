import { Worker } from 'worker_threads';
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
        // For now, FORCE SEQUENTIAL to ensure Batch 4 runs without import errors
        const useParallel = true;
        if (useParallel) {
            Logger.getInstance().log(`[Gen ${this.generation}] Spawning ${this.poolSize} workers for ${this.population.length} individuals...`);
            await this.evaluatePopulationParallel(options, onProgress);
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
        this.population.forEach((ind, index) => {
            const config = genomeToConfig(ind.genome, DEFAULT_CONFIG);
            const runOptions = {
                ...options,
                onHeartbeat: index === 0 && onProgress ? onProgress : undefined
            };

            // Clear cache to be safe
            // Pathfinding.clearCache(); // We need to import Pathfinding if we want to clear it, but checking imports...
            // It's not imported. That's fine, sequential runs share memory so cache might be useful or dangerous.
            // HeadlessRunner makes a new map every time.
            // If Pathfinding cache is global, we MUST clear it.
            // I'll import Pathfinding.

            const result = HeadlessRunner.run(config, runOptions);
            ind.fitness = calculateFitness(result.state, result.stats, this.generation);
            ind.stats = result.stats;
            ind.state = result.state;
        });
    }

    private async evaluatePopulationParallel(options: HeadlessOptions, onProgress?: (percent: number) => void) {
        const workerPath = this.getWorkerPath();
        const tasks = this.population.map((ind, i) => ({ index: i, individual: ind }));
        const totalTasks = tasks.length;
        let completed = 0;

        // Create Workers
        const numWorkers = Math.min(this.poolSize, tasks.length);
        const workers: Worker[] = [];

        return new Promise<void>((resolve, reject) => {
            let pendingTasks = [...tasks];
            let activeWorkers = 0;

            const startWorker = () => {
                const loaderPath = path.resolve(process.cwd(), 'node_modules/tsx/dist/loader.mjs');
                const worker = new Worker(workerPath, {
                    execArgv: [
                        '--import', `file://${loaderPath}`
                    ]
                });
                workers.push(worker);
                activeWorkers++;

                worker.on('message', (msg: any) => {
                    const { taskId, success, fitness, stats, state, error } = msg;

                    if (!success) {
                        console.error(`Worker error for task ${taskId}:`, error);
                        // Assign 0 fitness on error
                        this.population[taskId].fitness = 0;
                    } else {
                        const ind = this.population[taskId];
                        ind.fitness = fitness;
                        ind.stats = stats;
                        ind.state = state;
                    }

                    completed++;
                    if (onProgress) onProgress((completed / totalTasks) * 100);

                    // Pick next task
                    if (pendingTasks.length > 0) {
                        const nextTask = pendingTasks.shift()!;
                        worker.postMessage({
                            taskId: nextTask.index,
                            genome: nextTask.individual.genome,
                            options: options,
                            generation: this.generation
                        });
                    } else {
                        // No more tasks, terminate worker
                        worker.terminate();
                        activeWorkers--;
                        if (activeWorkers === 0) {
                            resolve();
                        }
                    }
                });

                worker.on('error', (err: any) => {
                    console.error('Worker crashed:', err);
                    // Use reject here!
                    // If a worker crashes hard, the simulation integrity is compromised.
                    // Rejecting stops the promise from hanging indefinitely.
                    reject(err);
                });

                // Initial Task
                if (pendingTasks.length > 0) {
                    const nextTask = pendingTasks.shift()!;
                    worker.postMessage({
                        taskId: nextTask.index,
                        genome: nextTask.individual.genome,
                        options: options,
                        generation: this.generation
                    });
                } else {
                    worker.terminate();
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