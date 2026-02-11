import { Genome, configToGenome, genomeToConfig } from './Genome';
import { calculateFitness } from './FitnessEvaluator';
import { HeadlessRunner, HeadlessOptions } from './HeadlessRunner';
import { DEFAULT_CONFIG } from '../../types/GameConfig';
import { SeedManager } from './SeedManager';

export interface Individual {
    genome: Genome;
    fitness: number;
}

export class Evolver {
    population: Individual[] = [];
    generation: number = 0;

    constructor(size: number) {
        const seedGenome = SeedManager.getSeed(DEFAULT_CONFIG);
        for (let i = 0; i < size; i++) {
            // Mix: 20% pure seed, 80% mutated seed
            const genome = i < (size * 0.2) ? seedGenome : this.mutate(seedGenome, 0.5);
            this.population.push({
                genome: genome,
                fitness: 0
            });
        }
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

    runGeneration(options: HeadlessOptions) {
        this.generation++;

        // Calculate mutation amount based on "cooling" schedule (decaying mutation)
        // Starts at base amount and reduces as we approach higher generations
        const maxGenerations = 200; // Expected total
        const coolingFactor = Math.max(0.1, 1.0 - (this.generation / maxGenerations));
        const currentMutationAmount = 0.5 * coolingFactor;

        // 1. Evaluate
        this.population.forEach(ind => {
            const config = genomeToConfig(ind.genome, DEFAULT_CONFIG);
            const result = HeadlessRunner.run(config, options);
            ind.fitness = calculateFitness(result.state, result.stats);
        });

        // 2. Sort by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);

        const best = this.population[0];
        if (this.generation % 10 === 0) {
            console.log(`Generation ${this.generation} Best Fitness: ${best.fitness.toFixed(2)} | Mutation Level: ${currentMutationAmount.toFixed(2)}`);
        }

        // 3. Selection (Keep top 10% elite)
        const eliteSize = Math.ceil(this.population.length * 0.1);
        const elite = this.population.slice(0, eliteSize);
        const newPopulation: Individual[] = [...elite];

        // 4. Repopulate using Crossover and Mutation
        while (newPopulation.length < this.population.length) {
            // Pick two parents from the top 50%
            const parentPool = this.population.slice(0, Math.ceil(this.population.length * 0.5));
            const p1 = parentPool[Math.floor(Math.random() * parentPool.length)];
            const p2 = parentPool[Math.floor(Math.random() * parentPool.length)];

            // Crossover
            const childGenome = this.crossover(p1.genome, p2.genome);

            // Mutate
            const mutatedGenome = this.mutate(childGenome, currentMutationAmount);

            newPopulation.push({
                genome: mutatedGenome,
                fitness: 0
            });
        }

        this.population = newPopulation;
        return best;
    }

    private crossover(g1: Genome, g2: Genome): Genome {
        const child = { ...g1 };
        const keys = Object.keys(child) as (keyof Genome)[];
        keys.forEach(key => {
            // 50% chance to inherit from p2 instead of p1
            if (Math.random() < 0.5) {
                (child[key] as any) = (g2[key] as any);
            }
        });
        return child;
    }
}
