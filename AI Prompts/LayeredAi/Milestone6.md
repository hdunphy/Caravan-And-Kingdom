# PROMPT: PROJECT SOVEREIGN - MILESTONE 6 (GLADIATOR EVOLUTION)

**Goal:** Refactor the Genetic Algorithm (GA) infrastructure to optimize the Hierarchical Blackboard architecture and introduce competitive "Gladiator" evaluation.

## 1. Genome Expansion (`Genome.ts`)
Update the DNA to include the new "Policy" and "Market" weights:
*   **Sovereign Policy:** 
    *   `sovereignFoodSurplus`: (Range: 0.5 to 0.9) - Target surplus for expansion.
    *   `sovereignDesperationRatio`: (Range: 0.3 to 0.6) - Threshold for scarcity overrule.
*   **Ant Bidding Weights:** 
    *   `bidDistanceWeight`: How heavily travel distance penalizes a bid.
    *   `bidSaturationWeight`: How much agents avoid already "claimed" job volume.
    *   `bidFulfillmentWeight`: How much Caravans/Villagers prefer jobs that match their capacity.

## 2. Milestone-Based Fitness (`FitnessEvaluator.ts`)
Shift from raw population counting to rewarding strategic execution:
*   **Goal Fulfillment:** Reward points for every `DesireTicket` completed (e.g., 500 per Outpost, 2000 per Town).
*   **Efficiency Bonus:** Apply a **Time-to-Completion** multiplier. Finishing an upgrade in 2000 ticks is worth 2x more than 8000 ticks.
*   **Labor Utilization:** Reward genomes based on the percentage of time agents spend in `BUSY` vs `IDLE` status.

## 3. The Gladiator Engine (`HeadlessRunner.ts` & `Evolver.ts`)
Refactor the evaluation logic to support direct faction-vs-faction competition:
*   **Multi-Genome Runs:** Modify `HeadlessRunner.run()` to accept an **Array of Configs**. Faction 1, 2, and 3 should each use a different individual from the population.
*   **Shared Environment:** Evaluate 3 unique genomes on the same map simultaneously. 
*   **Relative Fitness:** Fitness is now determined by the faction's **performance against its rivals** (e.g., % of total territory controlled, total faction wealth).
*   **Strategic Early Out:** If a faction has not completed a single goal ticket (Upgrade/Settler) by tick 3,000, terminate their simulation and assign a `STAGNATION_PENALTY` (-5000).

## 4. Integration & Performance
*   Ensure the `pathfindingCache` is cleared between individuals but shared across the 3 competitive factions in a single run.
*   Update the `State of the Realm` summary to show the "Winning Strategy" (e.g., "The Expansionist Genome defeated the Industrialist Genome").

---
**Build Safety:**
*   Maintain the `.ts` extension strictness for all worker thread imports.
*   Ensure `Logger.setSilent(true)` is applied to all factions in the headless run.
