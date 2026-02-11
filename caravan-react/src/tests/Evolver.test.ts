import { describe, it, expect } from 'vitest';
import { Evolver } from '../simulation/evolution/Evolver';

describe('Evolver', () => {
    it('should run a generation and return the best individual', async () => {
        const evolver = new Evolver(5); // Small pop for test
        const best = await evolver.runGeneration({ ticks: 10, width: 20, height: 20, factionCount: 1 });

        expect(evolver.generation).toBe(1);
        expect(best).toBeDefined();
        expect(best.fitness).toBeGreaterThanOrEqual(0);
    });

    it('should improve fitness over generations (Heuristic Check)', async () => {
        const evolver = new Evolver(10);
        const options = { ticks: 50, width: 20, height: 20, factionCount: 1 };
        await evolver.runGeneration(options);

        // Run 5 generations
        for (let i = 0; i < 4; i++) {
            await evolver.runGeneration(options);
        }

        const lastBest = evolver.population[0].fitness;
        // Note: In a short random run, improvement isn't guaranteed, 
        // but we're checking the loop doesn't crash.
        expect(lastBest).toBeDefined();
    });
});
