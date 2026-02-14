import { HeadlessRunner } from './src/simulation/evolution/HeadlessRunner';
import { DEFAULT_CONFIG } from './src/types/GameConfig';
import { Logger } from './src/utils/Logger';

async function debug() {
    Logger.getInstance().setSilent(false);
    console.log("Starting Debug Simulation (1000 Ticks)...");
    
    const options = {
        ticks: 1000,
        width: 40,
        height: 40,
        factionConfigs: [DEFAULT_CONFIG, DEFAULT_CONFIG, DEFAULT_CONFIG],
        useWorker: false
    };

    try {
        const result = HeadlessRunner.run(DEFAULT_CONFIG, options);
        console.log("Simulation Finished Successfully.");
        console.log("Stats:", JSON.stringify(result.stats, null, 2));
    } catch (err) {
        console.error("Simulation Crashed!");
        console.error(err);
    }
}

debug();
