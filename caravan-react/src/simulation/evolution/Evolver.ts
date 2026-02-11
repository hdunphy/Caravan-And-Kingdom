import { Genome, configToGenome, genomeToConfig } from './Genome';
import { calculateFitness } from './FitnessEvaluator';
import { HeadlessRunner } from './HeadlessRunner';
import { DEFAULT_CONFIG } from '../../types/GameConfig';

export interface Individual {
    genome: Genome;
    fitness: number;
}

export class Evolver {
    population: Individual[] = [];
    generation: number = 0;

    constructor(size: number) {
        const baseGenome = configToGenome(DEFAULT_CONFIG);
        for (let i = 0; i < size; i++) {
            this.population.push({
                genome: this.mutate(baseGenome, 0.5), // Heavy initial mutation
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

    runGeneration(ticks: number) {
        this.generation++;
        
        // 1. Evaluate
        this.population.forEach(ind => {
            const config = genomeToConfig(ind.genome, DEFAULT_CONFIG);
            const finalState = HeadlessRunner.run(config, ticks);
            ind.fitness = calculateFitness(finalState);
        });

        // 2. Sort by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);

        const best = this.population[0];
        console.log(`Generation ${this.generation} Best Fitness: ${best.fitness}`);

        // 3. Selection (Keep top 20%)
        const survivors = this.population.slice(0, Math.ceil(this.population.length * 0.2));
        const newPopulation: Individual[] = [...survivors];

        // 4. Repopulate with mutations of survivors
        while (newPopulation.length < this.population.length) {
            const parent = survivors[Math.floor(Math.random() * survivors.length)];
            newPopulation.push({
                genome: this.mutate(parent.genome, 0.1), // Subtle refinement
                fitness: 0
            });
        }

        this.population = newPopulation;
        return best;
    }
}
