@echo off
timeout /t 900
echo Starting Batch 6 Marathon (Feudal Era)...
call node_modules\.bin\tsx.cmd src/simulation/evolution/RunEvolution.ts BATCH6 200 25000 default config_results_batch6.json > evolution_logs_batch6.txt 2>&1
echo Done.
pause
