@echo off
REM Check if we are in the right directory
if not exist "package.json" (
    echo [ERROR] package.json not found. Please run this script from the 'caravan-react' directory.
    pause
    exit /b 1
)

echo ------------------------------------------------
echo CHECKING ENVIRONMENT
echo ------------------------------------------------
if exist "node_modules\.bin\tsx.cmd" (
    echo [OK] tsx found in node_modules
    set TSX_CMD=node_modules\.bin\tsx.cmd
) else (
    echo [ERROR] tsx not found. Run 'npm install' first.
    pause
    exit /b 1
)

echo ------------------------------------------------
echo BATCH 2: High Intensity Refinement
echo 3 runs, 200 generations each, 20,000 tick marathons
echo ------------------------------------------------

FOR /L %%i IN (1,1,3) DO call :RUN_BATCH_2 %%i

GOTO :RUN_BATCH_3

:RUN_BATCH_2
set "ID=%1"
echo ------------------------------------------------
echo STARTING MARATHON RUN %ID% OF 3 (20,000 TICKS)
echo ------------------------------------------------
call %TSX_CMD% src/simulation/evolution/RunEvolution.ts "batch2_%ID%" 200 20000 "optimized-config-run-2.json" "config_results_20000_ticks_%ID%.json" > "evolution_logs_batch2_%ID%.txt" 2>&1
exit /b

:RUN_BATCH_3
echo ------------------------------------------------
echo BATCH 3: The Ultra-Marathon
echo 1 final batch, 200 generations, 50,000 ticks for extreme stability
echo ------------------------------------------------
echo STARTING ULTRA-MARATHON (50,000 TICKS)
echo ------------------------------------------------
call %TSX_CMD% src/simulation/evolution/RunEvolution.ts "ultra" 200 50000 "optimized-config-run-2.json" "config_results_50000_ticks.json" > "evolution_logs_ultra.txt" 2>&1

echo ALL BATCHES COMPLETE.
pause
