# PROMPT: PROJECT SOVEREIGN - MILESTONE 3 (GOAL DECOMPOSITION & THE PLANNER)

**Goal:** Implement a programmatic GOAP (Goal-Oriented Action Planning) engine that decomposes high-level Faction Desires into atomic, prioritized tasks in a centralized Job Pool.

## 1. Urgency Tiers & The Priority Formula
To prevent "Economic Deadlock," all jobs must be categorized into one of three Urgency Tiers:
1.  **HIGH (Critical):** Survival (Food < 20%), Emergency Maintenance (Integrity < 30%), Defensive actions.
2.  **MEDIUM (Strategic):** Tech Upgrades, Colony Expansion, Infrastructure (Fisheries, Smithies), Faction Shortages.
3.  **LOW (Growth):** Tool production, Gold hoarding, General surplus gathering.

**The Priority Accumulator Formula:**
`Job_Priority = (Base_Tier_Value + sum(Desire_Utility_Scores)) * Efficiency_Modifier`
*   *Efficiency Modifier:* 1.2x for hexes that provide multiple resources currently in demand.

## 2. The Data Structures

### A. The Job Ticket (`AITypes.ts`)
```typescript
export interface JobTicket {
    jobId: string;
    factionId: string;
    sourceId: string; // Settlement requesting the job
    type: 'COLLECT' | 'BUILD' | 'RECRUIT' | 'EXPAND'; // Simplified types
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    priority: number;
    targetHexId?: string; // Optional for multi-source jobs
    resource?: ResourceType;
    targetVolume: number; // e.g. 500 units total
    assignedVolume: number; // Current worker commitment
    status: 'OPEN' | 'SATURATED' | 'COMPLETED';
}
```

### B. The Global Job Pool (`JobPool.ts`)
A centralized registry for each Faction that handles:
*   **Saturation:** Monitors `assignedVolume` vs `targetVolume`.
*   **Cleanup:** Automatically expires tickets if the goal is satisfied.

## 3. The Action Library (`GOAPActions.ts`)
Define atomic "Methods" the micro-agents can use to fulfill a job:
*   **`Gather`**: Land Hex + Resource ➡️ Add to Cargo.
*   **`Freight`**: Friendly Stockpile Surplus ➡️ Add to Cargo.
*   **`Trade`**: Rival Stockpile Surplus + Gold ➡️ Add to Cargo.

## 4. The Planner Algorithm (`GOAPPlanner.ts`)
The Planner runs every 100 ticks and follows these steps for every **Desire Ticket** on the Blackboard:

1.  **Audit:** Check the `needs` array of the Desire Ticket (e.g., `['Stone', 'Timber']`).
2.  **Decompose:** 
    *   For each missing resource, create or update a **`COLLECT`** Job Ticket.
    *   Set the `targetVolume` to the total amount needed across the faction for that resource.
3.  **Terminal Actions:** 
    *   If resources for an upgrade/building are present ➡️ Generate a **`BUILD`** ticket.
    *   If population for a settler is present ➡️ Generate an **`EXPAND`** ticket.
4.  **Priority Calculation:** 
    *   Sum the utility scores of all Desires that requested this resource.
    *   Map to the correct Urgency Tier (High/Medium/Low).
5.  **Post:** Update the Faction Blackboard.

## 5. Integration Tasks
*   **AIController.ts:** Replace the old "ExecuteAction" switch with a call to the `GOAPPlanner.plan(faction)`.
*   **SovereignAI.ts:** Ensure the King's "Critical Shortages" are correctly flagged for the Planner to prioritize.

---
**Build Safety:**
*   Ensure all new classes are unit-tested for "Priority Overlap" (Food must always win over Ore).
*   Maintain strictly "Silent" logs during evaluation runs.
