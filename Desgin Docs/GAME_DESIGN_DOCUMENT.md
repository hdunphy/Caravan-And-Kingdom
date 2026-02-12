# Game Design Document: Caravan and Kingdom (v4.0)
*Status: Technical Implementation Overview*

## 1. Executive Summary
**Caravan and Kingdom** is a physicalized strategy simulation where empire management is driven by logistics and autonomous agent behavior. Unlike abstract 4X games, resources must be physically extracted, transported, and stored. The game features a "Live World" where AI factions operate under a Parallel Governor architecture, and villagers act as "Reactive Ants" to manage local infrastructure.

---

## 2. The Physical World

### 2.1 Hex-Based Geography
The world is composed of a hexagonal grid. Each hex has a specific **Terrain Type** that dictates its resource potential and movement difficulty.

| Terrain | Yields (Primary) | Strategic Importance |
| :--- | :--- | :--- |
| **Plains** | Food | Primary population growth centers. |
| **Forest** | Timber | Critical for construction and caravan maintenance. |
| **Hills** | Stone | Required for high-tier upgrades and roads. |
| **Mountains**| Ore | Essential for advanced tools and industry. |
| **Water** | Food (Fish) | Accessible via Fishery buildings on adjacent land. |

### 2.2 Movement & Pathfinding
Agents (Caravans, Villagers, Settlers) use A\* pathfinding to navigate. Movement speed is influenced by terrain cost:
- **Plains**: 1.0 (Standard)
- **Forest**: 2.0 (Slow)
- **Hills**: 3.0 (Very Slow)
- **Mountains**: 6.0 (Nearly Impassable)

---

## 3. The Resource Economy

### 3.1 Sinks and Sources
The economy operates on a "Repair and Consumption" loop:
- **Metabolism**: Population consumes **Food** every tick. If food runs out, population declines.
- **Maintenance**: Buildings and agents have **Integrity**. Maintenance systems consume **Timber** and **Stone** to perform repairs.
- **Tools**: Manufactured from **Ore** and **Timber**, tools provide a global yield bonus but break periodically during use.

### 3.2 Physical Extraction
Resources are extracted from controlled hexes and accumulate **on the hex itself**. They are not part of the city's stockpile until they are physically transported by a Villager or Caravan.

---

## 4. The AI Brain (Governor System)

The AI utilizes a **Parallel Governor Architecture** to prevent priority locking and ensure balanced development.

### 4.1 Governor Roles
1. **Civil Governor**: Manages construction projects, settlement upgrades, and expansion (Settlers).
2. **Labor (HR) Governor**: Manages the recruitment of villagers and assigns high-level focus (e.g., "Focus on Timber").
3. **Transport Governor**: Orchestrates the building and dispatching of **Logistics Caravans** to collect remote resources.
4. **Trade Governor**: Scans for profitable trade routes with neighboring settlements to acquire missing resources via gold exchange.

### 4.2 Goal Evaluation
Settlements dynamically switch between "Goals" based on their current needs:
- **SURVIVE**: Food is critical; all non-essential labor is redirected to foraging.
- **THRIFTY**: Resources are low; recruitment is paused.
- **UPGRADE**: Saving materials for the next Tier (Village -> Town -> City).
- **EXPAND**: Preparing to send a Settler to found a new colony.

---

## 5. Autonomous Agents

### 5.1 Reactive Ants (Villagers)
Villagers are the lifeblood of a settlement. They operate semi-autonomously using "Ant Logic":
- **Local Gathering**: Idle villagers scan nearby controlled hexes for resources required by the city's goals.
- **Internal Freight**: Villagers automatically move surplus resources between friendly settlements within a short distance.
- **Home Pool**: Villagers return to the "Available Pool" after every mission, allowing for dynamic task switching.

### 5.2 Caravans & Logistics
Caravans handle long-distance and heavy-duty transport:
- **Logistics Missions**: Collecting large quantities of resources from remote extraction points.
- **Trade Missions**: Outbound trips to buy resources from neighbors using Gold.
- **Maintenance**: Caravans lose integrity over time and must return to a settlement with Timber for repairs.

---

## 6. Settlement Mechanics

### 6.1 Tiers & Growth
Settlements progress through three tiers: **Village**, **Town**, and **City**. Each tier increases the Job Capacity, Population limits, and unlocks new Building Types.

### 6.2 Dynamic Settlement Roles
Based on the surrounding geography, settlements automatically adopt specialized roles that grant utility bonuses:
- **LUMBER**: >30% Forest coverage. Focuses on Timber extraction.
- **MINING**: >30% Hills/Mountains. Focuses on Stone and Ore.
- **GRANARY**: >50% Plains. Focuses on extreme Food production.
- **GENERAL**: Balanced geography.

### 6.3 Construction
Available buildings include:
- **Extraction**: Gatherer's Hut, Sawmill, Masonry, Smithy.
- **Infrastructure**: Warehouse (Capacities), Paved Roads (Static markers), Market Hall.
- **Specialized**: Fishery (allows water extraction).

---

## 7. Technical Architecture
The simulation is built on an **Entity-Component-System (ECS)**-like model:
- **WorldState**: A central singleton containing all Hexes, Settlements, and Agents.
- **GameLoop**: Executes systems in a deterministic order (Extraction -> Metabolism -> Movement -> AI -> Logistics).
- **Determinism**: The core logic is decoupled from React's rendering, allowing for batch simulations and evolution-based testing.
