# Task Prompt: Advanced Fitness Function for Genetic Algorithm

## **1. Context Overview**
We have recently implemented a **Genetic Algorithm (GA)** infrastructure in `src/simulation/evolution/` to automatically optimize the AI's utility weights. 
- **Genome.ts**: Maps AI utility weights (surviveThreshold, growthFoodSafety, etc.) to a "DNA" structure.
- **Evolver.ts**: Manages the population, selection, and mutation.
- **HeadlessRunner.ts**: Runs a 2,000+ tick simulation without a UI to test a specific set of weights.
- **FitnessEvaluator.ts**: The "Judge" that determines if a specific weight set is successful.

## **2. Your Objective**
Refactor the logic in `caravan-react/src/simulation/evolution/FitnessEvaluator.ts` to implement a more sophisticated scoring system. We want to move beyond simple population counts and reward **Efficiency, Diversity, and Stability.**

---

## **3. Technical Specification (The Scoring Rules)**

### **A. Baseline Scores (Keep current logic)**
- **+1 point** per Population.
- **+100 points** per Settlement.
- **+500 points** for a Town (Tier 1).
- **+2,000 points** for a City (Tier 2).
- **+0.1 points** per Gold in the global faction pool.
- **-5,000 points** for Total Extinction (if settlements reach 0).

### **B. Diversity Bonus (+100 Points Max)**
Reward the AI for maintaining a balanced stockpile (Food, Timber, Stone, Ore). 
- Calculate the `Spread` (Difference between the largest and smallest stockpile, excluding Tools).
- **Rule:** 
    - If `Spread <= 500`: Award the full **100 points**.
    - If `Spread >= 2,000`: Award **0 points**.
    - If between 500 and 2,000: Scale the reward linearly (e.g., 1,250 spread = 50 points).

### **C. Stability Penalty (-5 Points per Survival Tick)**
We want to punish the AI for entering "Panic Mode."
- Track how many ticks any settlement spends in the `SURVIVE` state.
- **Rule:** Deduct **5 points** for every cumulative tick spent in survival mode across all settlements.

### **D. Idle Penalty (-0.1 Points per Idle Tick)**
Reward AIs that keep their workforce busy.
- Track total ticks where a Villager or Caravan has `status: 'IDLE'`.
- **Rule:** Deduct **0.1 points** for every cumulative idle tick.

---

## **4. Handoff Checklist**
1.  Ensure `FitnessEvaluator.ts` has access to the tick-by-tick logs if needed, or update the `HeadlessRunner` to accumulate these stats (Survival Ticks, Idle Ticks) during the run.
2.  Update the unit tests in `src/tests/Evolver.test.ts` or create `src/tests/FitnessEvaluator.test.ts` to verify the new math.
3.  Change the logic in the Evolver to be modular so that we can set different parameters. For example, we can set the number of generations, the population size, the mutation rate, etc.
4.  Ensure that there is at least two Factions in the simulation. (This should be part of the parameters)
5.  The Map should be 50x50 for the simulation. (This should be part of the parameters)
6.  This should output the final GameConfig as a json file that can be imported into the game. Also print out the final fitness score and the best genome.
7.  Ensure `npm run build` passes after your changes.
