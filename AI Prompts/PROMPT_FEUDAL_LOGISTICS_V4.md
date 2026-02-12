# PROMPT: FEUDAL LOGISTICS & SPECIALIZATION (V4)

**Goal:** Decentralize the AI architecture, implement settlement roles, and enable internal villager-led logistics to create a "Hub-and-Spoke" emergent world (Mount & Blade style).

## 1. Hub-and-Spoke Foundation (World Initialization)
*   **Tier 1 Capitals:** Modify faction initialization logic. The starting settlement for every faction must begin at **Tier 1 (Town)**.
*   **Initial Territory:** Capitals should start with a **Range 2** territory (19 hexes) to provide immediate access to resource variety.
*   **Rule Change:** Remove the `plainsCount` requirement for all upgrades in `GameConfig.ts`. Upgrades should be gated by resources and population only.

## 2. Dynamic Settlement Roles
*   **Role Identification:** Add a `role: 'GENERAL' | 'LUMBER' | 'MINING' | 'GRANARY'` property to the `Settlement` interface.
*   **Assignment Logic:** Settlements should evaluate their controlled territory every 100 ticks:
    *   **LUMBER:** >30% Forest hexes.
    *   **MINING:** >30% Hills/Mountains hexes.
    *   **GRANARY:** >50% Plains hexes.
*   **AI Impact:** Introduce a **+25% Utility Score bonus** for actions matching the role (e.g., MINING roles prioritize building Smithies and dispatching villagers to Hills).

## 3. Internal Logistics (The "Feudal Supply Chain")
*   **Internal Freight:** Add a new villager mission: `INTERNAL_FREIGHT`.
*   **Logic:** If the Capital has <20% of a required resource (Timber/Stone) for an upgrade/building, and a friendly Outpost has >50% surplus, the Outpost dispatches a **Villager** to transport a small load (e.g., 20 units) directly to the Capital.
*   **Direct Bartering:** Modify `TradeStrategy.ts`. Settlements within the same faction should exchange resources at a **1:1 ratio**, bypassing Gold entirely.

## 4. Economic Pacing (The THRIFTY State)
*   **New Goal:** Implement a `THRIFTY` state in `GoalEvaluator.ts`.
*   **Trigger:** Food stockpile is between 20% and 50% of the "Survive Threshold."
*   **Behavior:** 
    *   Allow existing buildings/jobs to run.
    *   **Block** all `RECRUIT_VILLAGER` and `SPAWN_SETTLER` actions.
    *   Focus exclusively on gathering and essential maintenance.

## 5. Sovereign AI (Decentralization)
*   **Instance Mapping:** Refactor `AIController.ts` to maintain a `Map<string, FactionAI>` so each faction has its own independent memory and decision jitter.
*   **Reservation System:** When a faction targets a hex for expansion, mark that hex as `targetedBy: factionId` to prevent multiple settlements from spawning redundant settlers for the same location.

---
**Build Safety:**
*   Ensure all new properties are added to `WorldTypes.ts`.
*   Maintain strictly "Silent" logs during evaluation runs.
