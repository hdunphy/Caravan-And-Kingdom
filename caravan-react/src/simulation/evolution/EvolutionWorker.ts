import { parentPort } from 'worker_threads';
import { HeadlessRunner } from './HeadlessRunner.ts';
import { calculateFitness } from './FitnessEvaluator.ts';
import { Pathfinding } from '../Pathfinding.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { genomeToConfig, Genome } from './Genome.ts';
import { DEFAULT_CONFIG } from '../../types/GameConfig.ts';

if (!parentPort) {
    throw new Error('EvolutionWorker must be run as a worker thread.');
}

parentPort.on('message', (message: {
    taskId: number,
    genome: Genome,
    config?: GameConfig, // Optional override or seed
    options: any,
    generation: number
}) => {
    try {
        // 1. Clear Pathfinding Cache to prevent memory leaks and cross-run contamination
        Pathfinding.clearCache();

        // 2. Prepare Config
        const gameConfig = genomeToConfig(message.genome, message.config || DEFAULT_CONFIG);

        // 3. Run Simulation
        // We override onHeartbeat to null since we can't easily proxy it back efficiently 
        // without constant posting. We'll just return final result.
        const runOptions = {
            ...message.options,
            onHeartbeat: undefined
        };

        const result = HeadlessRunner.run(gameConfig, runOptions);

        // 4. Calculate Fitness
        const fitness = calculateFitness(result.state, result.stats, message.generation);

        // 5. Send Result
        // We send back the stats and potentially the state if needed (for the best individual)
        // Note: sending full state might be heavy. 
        // The main thread only needs full state for the BEST individual.
        // We can optimize this: maybe only return state if fitness is high? 
        // Or just return it always for now—Structured Clone Algorithm handles it.
        // If performance is an issue, we can strip the state.

        parentPort!.postMessage({
            taskId: message.taskId,
            success: true,
            fitness,
            stats: result.stats,
            state: result.state // Transferring this might be the bottleneck.
        });

    } catch (error) {
        parentPort!.postMessage({
            taskId: message.taskId,
            success: false,
            error: error
        });
    }
});
