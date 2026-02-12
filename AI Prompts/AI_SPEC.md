# AI Specification: Utility-Based Desire System (v2.0)

This document defines the 8 "Desires" governing settlement AI. Every tick, the AI evaluates these desires based on the `WorldState` and `GameConfig`. The highest-scoring desire determines the settlement's primary action.

---

## **1. SURVIVE (Food Security)**
- **Goal:** Prevent population loss from starvation.
- **Formula:** `1.0 - (Current Food / criticalThreshold)` (Clamped 0.0 to 1.0).
- **Threshold:** `criticalThreshold` = `consumption * 15 ticks`.
- **Behavior:** At a score > 0.8, the AI enters "Emergency Mode," reassigning all villagers to Food and blocking all non-essential gold spending.

## **2. GROW (Workforce Recruitment)**
- **Goal:** Reach and maintain the ideal villager-to-population ratio.
- **Formula:** `(1.0 - (Total Villagers / Max Villagers)) * Food_Safety_Multiplier`.
- **Logic:** `Max Villagers` = `Population / config.popRatio`.
- **Multiplier:** `Food_Safety_Multiplier` scales from 0.0 to 1.0 based on how much food surplus exists above the `safeThreshold`.

## **3. PROVISION (Internal Logistics)**
- **Goal:** Collect resources (Timber, Stone, Ore) generated on remote hexes.
- **Formula:** `Sum(Resources on remote hexes * Priority_Weight) / (Logistics_Distance * 10)`.
- **Priority Weight:** 
    - Default = 1.0.
    - Resources required for an affordable **ASCEND** or **BUILD** = 2.5.
- **Behavior:** Triggers a `DISPATCH_VILLAGER` action to the hex with the highest priority score.

## **4. ASCEND (Tier Upgrades)**
- **Goal:** Advance from Village -> Town -> City to unlock new population caps.
- **Formula:** `(Current Pop / Pop Cap)^2 * READINESS`.
- **Readiness:** The average percentage completion of all required resources (Food, Timber, Stone, Ore).
- **Logic:** If Readiness is 0% (e.g., missing a required resource entirely), the Desire is 0.

## **5. BUILD (Infrastructure)**
- **Goal:** Construct **Gatherer's Huts** to boost resource yields.
- **Formula:** `(Consumption_Rate / Production_Rate) - (Built_Huts / Total_Plains)`.
- **Logic:** High desire if the settlement is consistently losing food or if it needs to accelerate gathering for a specific goal.

## **6. COMMERCIAL (Trade & Arbitrage)**
- **Goal:** Optimize the stockpile by buying what is missing and selling what is abundant.
- **Buy Logic:** Triggers if a resource is below `lowThreshold`. 
    - `Buy_Desire = (1.0 - Current_Stock / lowThreshold) * (Partner_Surplus / Distance)`.
- **Sell Logic:** Triggers if a resource is above `surplusThreshold`.
    - `Sell_Desire = (Current_Stock / surplusThreshold - 1.0) * (Partner_Deficit / Distance)`.
- **Behavior:** The highest of Buy or Sell desire becomes the Commercial score.

## **7. FLEET (Caravan Production)**
- **Goal:** Build the hardware (Caravans) required to execute trade or expansion.
- **Formula:** `Max(COMMERCIAL_Desire, EXPAND_Desire) - (Current_Fleet_Size / Target_Fleet_Size)`.
- **Behavior:** Spends Timber to build a new Caravan if the need for trade or strategic expansion outweighs the current fleet capacity.

## **8. EXPAND (Strategic & Pressure Growth)**
- **Goal:** Found new settlements for space or missing resources.
- **Saturation Mode:** `(Current Pop / Pop Cap)^3`. Triggered when a settlement is "bursting at the seams."
- **Strategic Mode:** If the current settlement has **zero yield** for a required resource (e.g., no Hills for Stone), it scans a 5-hex radius for that resource.
    - `Strategic_Desire = 1.0 / Distance_to_Resource`.
- **Behavior:** If either mode scores high, the AI spawns a `Settler` agent with a "Starter Pack" of resources.
