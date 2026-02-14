@echo off
setlocal enableextensions enabledelayedexpansion

timeout /t 1200

REM Usage: run_batch.bat [BATCH_NUMBER] [OPTIONAL_SEED_FILE_PATH]

if "%1"=="" (
    echo Error: Batch Number is required.
    echo Usage: run_batch.bat [BATCH_NUMBER] [OPTIONAL_SEED_FILE_PATH]
    exit /b 1
)

set BATCH_NUM=%1
set SEED_FILE=%2
set GEN=200
set TICKS=25000
set OUTPUT_FILE=config_results_%BATCH_NUM%.json
set LOG_FILE=evolution_logs_%BATCH_NUM%.txt

echo Starting Batch %BATCH_NUM%...
echo Generations: %GEN%
echo Ticks: %TICKS%
echo Output: %OUTPUT_FILE%
echo Log: %LOG_FILE%

IF NOT "%SEED_FILE%"=="" GOTO UseSeed
GOTO Default

:UseSeed
echo Seed File: %SEED_FILE%
call "node_modules\.bin\tsx.cmd" src/simulation/evolution/RunEvolution.ts %BATCH_NUM% %GEN% %TICKS% %SEED_FILE% %OUTPUT_FILE% > %LOG_FILE% 2>&1
GOTO Done

:Default
echo No Seed File provided (Starting Default).
REM Pass empty string for seed file
call "node_modules\.bin\tsx.cmd" src/simulation/evolution/RunEvolution.ts %BATCH_NUM% %GEN% %TICKS% "" %OUTPUT_FILE% > %LOG_FILE% 2>&1
GOTO Done

:Done
echo Done.
