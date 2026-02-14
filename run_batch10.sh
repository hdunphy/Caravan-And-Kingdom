#!/bin/bash
cd caravan-react
npx tsx src/simulation/evolution/RunEvolution.ts BATCH10 200 25000 config_results_batch9.json config_results_batch10.json > evolution_logs_batch10.txt 2>&1
