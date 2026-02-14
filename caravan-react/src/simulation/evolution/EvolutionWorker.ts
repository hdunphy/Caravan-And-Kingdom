// import { parentPort } from 'worker_threads';
import { HeadlessRunner } from './HeadlessRunner.ts';
import { calculateFitness } from './FitnessEvaluator.ts';
import { Pathfinding } from '../Pathfinding.ts';
import { GameConfig } from '../../types/GameConfig.ts';
import { DEFAULT_CONFIG } from '../../types/GameConfig.ts';


if (!process.send) {
    throw new Error('EvolutionWorker must be run as a child process via fork.');
}

process.on('message', (message: {
    indices: number[],
    factionConfigs: GameConfig[],
    options: any,
    generation: number
}) => {
    const { indices, factionConfigs, options, generation } = message;

    try {
        // 1. Clear Pathfinding Cache to prevent memory leaks and cross-run contamination
        Pathfinding.clearCache();

        // 2. Prepare Config
        const runOptions = {
            ...options,
            factionConfigs: factionConfigs,
            onHeartbeat: undefined
        };

        // 3. Run Simulation
        const result = HeadlessRunner.run(DEFAULT_CONFIG, runOptions);

        const factionResults: Record<string, { fitness: number, stats: any }> = {};

        // 4. Calculate Fitness for each faction
        indices.forEach((_popIndex: number, i: number) => {
            const factionId = i === 0 ? 'player_1' : `rival_${i}`;
            const fitness = calculateFitness(result.state, result.stats, factionId, generation);
            const fStats = result.stats.factions[factionId];
            factionResults[factionId] = { fitness, stats: fStats };
        });

        // 5. Send Result
        if (process.send) {
            // Simplify stats for transmission to avoid serialization overhead
            const cleanStats = JSON.parse(JSON.stringify(result.stats));
            process.send({
                success: true,
                results: {
                    indices: indices,
                    factions: factionResults,
                    stats: cleanStats
                }
            });
        }

    } catch (error: any) {
        console.error(`[Worker Error] ${error.message}`);
        if (process.send) {
            process.send({
                matchId: indices ? indices[0] : -1,
                success: false,
                error: {
                    message: error.message || String(error),
                    stack: error.stack
                }
            });
        }
    }
});
