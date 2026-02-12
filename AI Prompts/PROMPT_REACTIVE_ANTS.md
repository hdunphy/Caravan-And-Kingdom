# ARCHITECT SPEC: REACTIVE ANT LOGIC (V4.1)

**Goal:** Transform villagers into autonomous units that respond to resource "pressure" every tick, bypassing the periodic AI Governor loop.

## 1. Data Structure Updates (`WorldTypes.ts`)
*   **Settlement:**
    *   `resourceGoals: Resources`: Add target levels for all resources (Food, Timber, Stone, Ore, Tools).
    *   Default Goals: 1000 Food, 300 Timber, 200 Stone, 100 Ore, 50 Tools.
*   **VillagerAgent:**
    *   `lastActionTick: number`: Track when the ant last made a decision.

## 2. The Pressure System (`VillagerSystem.ts`)
*   **Update Loop:**
    *   If a Villager is `IDLE` and at `home`:
        1.  Calculate **Pressure Map** for the home settlement.
            *   `Pressure = Math.max(0, (Goal - Current) / Goal)`
        2.  Identify the resource with the **Highest Pressure**.
        3.  **Autonomous GATHER:**
            *   Scan controlled land hexes within `config.costs.villagers.range`.
            *   If hex has the highest-pressure resource, `spawnVillager` toward it.
        4.  **Autonomous FREIGHT:**
            *   If local Pressure is 0 for a resource (Goal met), scan neighboring friendly settlements within 10 tiles.
            *   If neighbor has Pressure > 0.5 for that resource, dispatch to `INTERNAL_FREIGHT`.

## 3. Governor Removal (`AIController.ts`)
*   **Decoupling:** Remove `VillagerStrategy` from `hrStrategies` and `LABOR` governor. 
*   **Focus:** Ensure the Governor only manages `BUILD`, `UPGRADE`, and `EXPAND` actions.

## 4. Pathfinding Safeguards
*   **Water:** Ensure `Villager` agentType in `Pathfinding.ts` remains at cost 1000 (Impassable).

## 5. TDD Requirements
*   `ReactiveAnts.test.ts` must verify:
    1.  Villagers auto-dispatch to food tiles when stockpile is empty.
    2.  Villagers shift to timber when food goal is 100% met.
    3.  Villagers ignore water tiles even if they contain food.
