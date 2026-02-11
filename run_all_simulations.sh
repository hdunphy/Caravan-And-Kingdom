#!/bin/bash
cd caravan-react
for i in {1..5}
do
   echo "Starting Simulation Run $i of 5..."
   npx tsx src/simulation/evolution/RunEvolution.ts $i 100
done
echo "All 5 Simulation Runs Complete."
