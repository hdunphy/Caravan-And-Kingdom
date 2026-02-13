@echo off
timeout /t 2500
echo Starting Batch 9 Marathon (Feudal Era)...
call node_modules\.bin\tsx.cmd src/simulation/evolution/RunEvolution.ts BATCH9 200 25000 config_results_batch9.json config_results_batch9.json > evolution_logs_batch9.txt 2>&1
echo Done.
pause
