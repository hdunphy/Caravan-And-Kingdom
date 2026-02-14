# PROMPT: PROJECT SOVEREIGN - MILESTONE 5 (THE ROYAL LEDGER)

**Goal:** Implement a comprehensive analytics dashboard (The Royal Ledger) to provide real-time visibility into the Hierarchical AI's strategic stances, active projects, and labor distribution. Also make sure to implement easy controls to swtich betweeen different factions and settlements per context of the view.

## 1. Faction Overview: The Sovereign Gauge
Create a `FactionSovereignPanel.tsx` that visualizes the top-level "King" logic per faction:
*   **The Stance Gauge:** A horizontal balance bar showing the tension between `EXPAND` (Left) and `EXPLOIT` (Right).
    *   Include a "Ghost Needle" representing the **Moving Average** of the stance over the last 1,000 ticks to show long-term intent.
*   **Strategic Alerts:** A list of active `CriticalShortages` (from the Blackboard) with flashing icons if a resource is below the 10% density threshold.

## 2. Active Projects: The Governor's Checklist
Create a `SettlementProjectFeed.tsx` that aggregates abstract `DesireTickets` into human-readable goals:
*   **Aggregation Logic:** Group tickets by type across all settlements in the selected faction.
*   **Visuals:** Render a list of "Active Projects" (e.g., "Colonizing the Frontier", "Upgrading the Capital").
*   **Resource Tracking:** For projects like `UPGRADE` or `SPAWN_SETTLER`, show a multi-segment progress bar representing the required materials (Food/Stone/Timber).

## 3. Workforce Insights: The Ant Ticker
Create a `WorkforceDistribution.tsx` component to visualize the "Market Dispatcher" in action:
*   **The Labor Donut:** A chart (or simple stacked bar) showing the % of agents assigned to each Urgency Tier:
    *   🔴 **HIGH:** Survival/Food gathering.
    *   🟡 **MEDIUM:** Strategic projects (Expansion/Construction).
    *   🟢 **LOW:** General surplus/Gold hoarding.
*   **Summarized Bounty Board:** A table listing the current `JobTickets` from the Blackboard:
    *   *Columns:* `Job Type`, `Target Resource`, `Priority`, `Assigned Volume / Target Volume`.
    *   *Sorting:* Always show the highest priority "Bounties" at the top.

## 4. UI Architecture & Performance
*   **Sampling Rule:** To prevent simulation lag, the Ledger components must only refresh their data from the `FactionBlackboard` once every **100 simulation ticks**.
*   **State Decoupling:** Use a custom hook `useBlackboard(factionId)` to fetch and memoize the data, ensuring the rest of the map grid doesn't re-render when the Ledger updates.
*   **Visual Smoothing:** Apply Tailwind CSS transitions (`duration-500`) to all progress bars and gauges to create a fluid "living data" feel.

---
**Build Safety:**
*   Ensure the dashboard is accessible via a new "Ledger" tab in the right-hand sidebar.
*   Verify that the UI remains responsive even when the simulation is running at 5x speed.
