@echo off
echo Starting Batch 10 Marathon (Pro-Circulation and Trade Fix Era)...
call node_modules\.bin\tsx.cmd src/simulation/evolution/RunEvolution.ts BATCH10 200 25000 config_results_batch9.json config_results_batch10.json > evolution_logs_batch10.txt 2>&1
echo Done.
pause
