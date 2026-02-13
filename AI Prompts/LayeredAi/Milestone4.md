# PROMPT: PROJECT SOVEREIGN - MILESTONE 4 (THE BLACKBOARD DISPATCHER)

**Goal:** Implement a centralized bidding and fulfillment engine on the `FactionBlackboard` that enables agents to autonomously claim "COLLECT" and "BUILD" bounties based on individual ROI and real-time job saturation.

## 1. Blackboard Brain: The Bidding Engine
Instead of agents calculating their own scores in isolation, the logic is moved to the **Blackboard** to ensure saturation is handled accurately.

*   **`FactionBlackboard.calculateBid(agent, jobId)`**:
    *   **Resource Availability:** For `COLLECT` jobs, identify the closest valid source (Land Hex, Friendly Granary, or Rival Market).
    *   **Distance Factor:** `1.0 / (Travel_Distance * config.costs.movement_penalty)`.
    *   **Fulfillment Factor:** `Agent_Capacity / Job_Remaining_Amount`. (High capacity agents like Caravans prefer large `COLLECT` bounties).
    *   **Saturation Factor:** `1.0 - (Job.assignedVolume / Job.targetVolume)`.
    *   **Formula:** `Final_Score = (Base_Priority * Saturation_Factor) * Distance_Factor * Fulfillment_Factor`.

## 2. Job Pool & Volume Tracking
Job tickets now act as "Global Bounties":
*   `targetVolume: number` (e.g., 500 units total).
*   `assignedVolume: number` (The sum of all cargo capacities of agents currently committed).
*   `status: 'OPEN' | 'SATURATED' | 'COMPLETED'`.
*   **Saturation Logic:** Once `assignedVolume >= targetVolume`, the job becomes `SATURATED` and is hidden from the board until a worker fails or progress updates.

## 3. The Fulfillment Protocol
Update `VillagerSystem.ts` and `CaravanSystem.ts` to follow the autonomous "Ant Routine":

1.  **Poll (Tick-Based):** If an agent is `IDLE` at home.
2.  **Request:** `Blackboard.getTopAvailableJobs(agent, limit: 5)`.
    *   The Blackboard runs `calculateBid` for the agent against all `OPEN` jobs and returns the winners.
3.  **Claim:** `Blackboard.claimJob(agent, jobId)`.
    *   The Blackboard adds the agent's capacity to the job's `assignedVolume`.
    *   The agent sets `status = BUSY` and `targetHexId = job.targetHexId`.
4.  **Execute:** Agent moves to target ➡️ Performs action ➡️ Returns ➡️ Deposits.
5.  **Finalize:** Upon deposit, the agent tells the Blackboard to **Update Job Progress**. If the `targetVolume` is hit, the job is moved to `COMPLETED`.

## 4. Error Handling (The "Forgetful Ant" Rule)
*   **Claim Expiry:** If an agent is destroyed or takes >500 ticks to deliver, the Blackboard must automatically subtract that agent's capacity from the `assignedVolume` to allow others to finish the job.

---
**Build Safety:**
*   Ensure `calculateBid` is highly optimized (no expensive pathfinding; use Axial Distance for initial scoring).
*   Unit Test: Verify that a single 500-unit Food job correctly accepts multiple 20-unit Villagers until full.
