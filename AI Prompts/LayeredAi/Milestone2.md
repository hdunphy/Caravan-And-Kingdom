# PROMPT: PROJECT SOVEREIGN - MILESTONE 2 (SETTLEMENT AMBITION)

**Goal:** Refactor the settlement decision logic into a `SettlementGovernor` class that generates weighted "Desire Tickets" based on local needs and the Sovereign's Strategic Stance.

## 1. The Desire Ticket System
*   **Definition:** A `DesireTicket` is a utility-based request posted to the `FactionBlackboard`.
*   **Ticket Schema:**
    ```typescript
    {
        settlementId: string;
        type: DesireType; // e.g., 'UPGRADE', 'SETTLER', 'BUILD_FISHERY'
        score: number;    // 0.0 to 1.0 (Utility)
        needs: ResourceType[]; // Guidance for the GOAP Planner
    }
    ```

## 2. Input Data (Governor's Intel)
The `SettlementGovernor` evaluates its own state and the Faction Blackboard every 100 ticks:
*   **Macro:** King's Stance (`EXPAND` vs. `EXPLOIT`) and Critical Shortages.
*   **Local:** Stockpile levels, Population vs. Job Capacity, Current Tier, and Settlement Role.
*   **Context:** Adjacency (e.g., "Is this a coastal hex?").

## 3. Utility Formulas (The Ambition Math)

### **A. Tech Ambition (`UPGRADE`)**
*   **Formula:** `(Population / Pop_Cap)^2 * Sovereign.Stance_Exploit`
*   **Penalty:** Multiply by `0.1` if `SURVIVE` mode is active.
*   **Needs:** `['Stone', 'Timber', 'Ore']`

### **B. Territorial Ambition (`SETTLER`)**
*   **Formula:** `0.8 * Sovereign.Stance_Expand * (Population / (Settler_Cost * 2))`
*   **Needs:** `['Food', 'Timber']`

### **C. Trade Ambition (`CARAVAN`)**
*   **Formula:** `0.4 + (0.15 * Sovereign.Critical_Shortages.length)`
*   **Logic:** Desire increases if the King reports the Faction is lacking basic materials.
*   **Needs:** `['Timber']`

### **D. Labor Ambition (`VILLAGER`)**
*   **Formula:** `(1.0 - (Population / Job_Cap)) * Food_Surplus_Ratio`
*   **Constraint:** Score must drop to `0.0` if in `THRIFTY` or `SURVIVE` mode.

### **E. Infrastructure Ambition (`FISHERY`, `GRANARY`, `SMITHY`)**
*   **GRANARY:** `(1.0 - Food_Health) * (Role == 'GRANARY' ? 1.5 : 1.0)`
*   **FISHERY:** `(1.0 - Food_Health) * (Adjacent_Water_Count > 0 ? 1.5 : 0.0)`
*   **SMITHY:** `(1.0 - (Tools / (Pop * 0.2))) * (Role == 'MINING' ? 1.2 : 1.0)`

### **F. Logistics Ambition (`REQUEST_FREIGHT`)**
*   **Formula:** High score if a specific resource is `< 20%` of its goal and Faction Blackboard shows a surplus exists elsewhere.

## 4. Execution Logic
*   **Multi-Ambition:** The Governor should calculate the score for ALL of the above and post every ticket with a `score > 0.1` to the Blackboard.
*   **Integration:** Remove the old "Goal" switching logic from `AIController.ts` and replace it with a call to the `SettlementGovernor.evaluate()` for each settlement.

---
**Build Safety:**
*   Update `AITypes.ts` to include the `DesireTicket` and `DesireType` definitions.
*   Ensure the `SovereignAI` evaluation happens *before* the `SettlementGovernor` runs.
