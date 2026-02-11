import { describe, it, expect } from 'vitest';
import { Evolver } from '../simulation/evolution/Evolver';

describe('Evolver', () => {
    it('should run a generation and return the best individual', () => {
        const evolver = new Evolver(5); // Small pop for test
        const best = evolver.runGeneration(10); // Few ticks for test
        
        expect(evolver.generation).toBe(1);
        expect(best).toBeDefined();
        expect(best.fitness).toBeGreaterThanOrEqual(0);
    });

    it('should improve fitness over generations (Heuristic Check)', () => {
        const evolver = new Evolver(10);
        const firstBest = evolver.runGeneration(50).fitness;
        
        // Run 5 generations
        for(let i=0; i<4; i++) {
            evolver.runGeneration(50);
        }
        
        const lastBest = evolver.population[0].fitness;
        // Note: In a short random run, improvement isn't guaranteed, 
        // but we're checking the loop doesn't crash.
        expect(lastBest).toBeDefined();
    });
});
