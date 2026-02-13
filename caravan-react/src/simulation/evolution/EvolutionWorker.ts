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
        // HeadlessRunner now takes global config + faction configs in options
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
            // Determine factionId based on index (player_1 for first, rival_X for others)
            const factionId = i === 0 ? 'player_1' : `rival_${i}`;
            const fitness = calculateFitness(result.state, result.stats, factionId, generation);
            const fStats = result.stats.factions[factionId];
            factionResults[factionId] = { fitness, stats: fStats };
        });

        // 5. Send Result
        process.send!({
            success: true,
            results: {
                indices: indices, // Echo back indices
                factions: factionResults,
                stats: result.stats // Overall faction stats
            }
        });

    } catch (error) {
        process.send!({
            matchId: indices ? indices[0] : -1, // Fallback ID
            success: false,
            error: error
        });
    }
});
