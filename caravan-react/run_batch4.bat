@echo off
timeout /t 1800
echo Starting Batch 8 Marathon (Feudal Era)...
call node_modules\.bin\tsx.cmd src/simulation/evolution/RunEvolution.ts BATCH8 200 25000 config_results_batch8.json config_results_batch8.json > evolution_logs_batch8.txt 2>&1
echo Done.
pause
