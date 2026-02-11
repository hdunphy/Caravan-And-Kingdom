#!/bin/bash
cd caravan-react

# BATCH 2: High Intensity Refinement
# 3 runs, 200 generations each, 20,000 tick marathons
for i in {1..3}
do
   echo "------------------------------------------------"
   echo "STARTING MARATHON RUN $i OF 3 (20,000 TICKS)"
   echo "------------------------------------------------"
   npx tsx src/simulation/evolution/RunEvolution.ts "batch2_$i" 200 20000
done

# BATCH 3: The Ultra-Marathon
# 1 final batch, 200 generations, 50,000 ticks for extreme stability
echo "------------------------------------------------"
echo "STARTING ULTRA-MARATHON (50,000 TICKS)"
echo "------------------------------------------------"
npx tsx src/simulation/evolution/RunEvolution.ts "ultra" 200 50000

echo "ALL BATCHES COMPLETE."
