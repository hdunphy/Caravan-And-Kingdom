# PROMPT: PROJECT SOVEREIGN - MILESTONE 1 (V5.1)

**Goal:** Implement the Faction Blackboard and the "Sovereign" (King) AI layer to set high-level strategic stances based on resource density and social stability.

## 1. Data Model Updates (`WorldTypes.ts`)
*   **`FactionBlackboard` Interface:**
    *   `factionId: string`
    *   `stances: { expand: number, exploit: number }` (Range 0.0 to 1.0)
    *   `criticalShortages: ResourceType[]` (List of resources below the Sovereign's threshold)
    *   `targetedHexes: string[]` (Hex IDs currently targeted for settlement)
*   **`Faction` Interface:**
    *   Add `blackboard: FactionBlackboard`.

## 2. Config Additions (`GameConfig.ts`)
*   Add `ai.sovereign` block:
    *   `checkInterval: 100` (Ticks between Sovereign audits)
    *   `foodSurplusRatio: 0.8` (Standard requirement for expansion)
    *   `desperationFoodRatio: 0.5` (Lowered food requirement during shortages)
    *   `scarcityThresholds: Record<ResourceType, number>`
        *   Default: `Stone: 0.1`, `Ore: 0.1`, `Timber: 0.1`, `Food: 0.0` (Food handled by surplus ratio).

## 3. The Sovereign AI (`SovereignAI.ts`)
Create a static class to handle faction-wide strategic audits.
*   **Step A: Faction Resource Audit:**
    *   Calculate the percentage of total owned hexes for each terrain type.
    *   If `(Owned_Stone_Tiles / Total_Owned_Tiles) < config.ai.sovereign.scarcityThresholds.Stone`, mark `Stone` as a **Critical Shortage**.
*   **Step B: Social Stability Audit:**
    *   `SurplusRatio = (Settlements with Food > SafeLevel) / Total_Settlements`.
*   **Step C: The Strategic Decision:**
    *   **STANCE_EXPAND = 1.0** IF:
        1. `Settlements < config.ai.settlementCap` AND `SurplusRatio >= foodSurplusRatio`.
        2. **OR (The Strategic Overrule):** Any resource is in **Critical Shortage** AND `SurplusRatio >= desperationFoodRatio`. (This overrule ignores the Settlement Cap).
    *   **STANCE_EXPLOIT = 1.0** IF:
        *   Above conditions are not met. (Exploit is the default mode for stability and vertical growth).

## 4. Integration & Logging
*   Update `AIController.ts` to execute `SovereignAI.evaluate()` at the top of the `update` loop.
*   Log major stance shifts: `[Sovereign] Faction X pivoting to EXPAND: Strategic shortage of Stone detected.`

## 5. TDD Requirements (`SovereignAI.test.ts`)
*   Verify `EXPAND` stance at 80% food surplus.
*   Verify `EXPAND` stance at 50% food surplus + <10% Stone density (Overrule).
*   Verify `EXPAND` stance breaks the `settlementCap` if a critical scarcity exists.
*   Verify `EXPLOIT` stance when no room is available and no shortages exist.
