#!/bin/bash
cd caravan-react
echo "Starting Batch 4 Marathon (Feudal Era)..."
npx tsx src/simulation/evolution/RunEvolution.ts BATCH4 200 20000 config_results_20000_ticks_3.json config_results_batch4_feudal.json > evolution_logs_batch4.txt 2>&1
echo "Done."
