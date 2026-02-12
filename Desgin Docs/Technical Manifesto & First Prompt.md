# **Technical Manifesto & Project Setup**

This document contains the architectural constraints and the first prompt needed to begin development with a coding agent.

## **Part 1: Architectural Constraints**

1. **Single Source of Truth:** All game data (World Map, Factions, Agent Positions, Stockpiles) must reside in a single, centralized worldState object.  
2. **Deterministic Tick System:** Game logic must be tied to a "Tick" system, not real-world time. One Tick \= One update cycle.  
3. **Agent Interface:** All moving entities (Caravans, Raiders, Armies) must share a common data structure: id, type, currentHex, targetHex, path\[\], cargo, and integrity.  
4. **Hexagonal Grid:** Use an **Axial Coordinate system** (q, r) for the grid to simplify neighbor-finding and distance math.  
5. **Pathfinding:** Implement A\* for agent movement, where "Road" hexes have a lower movement cost.

## **Part 2: The 6-Agent TDD Lifecycle (Updated 2026-02-10)**

For the `tdd-refactor` phase and beyond, all development follows this pipeline:

1.  **Patrick the PM (Manager):** Brainstorms with Lord Dunphy to create high-level technical specs and plans.
2.  **The Architect (Planning):** Translates specs into detailed AI prompts and defines expected behaviors for other agents.
3.  **The Test-Pilot (Red Phase):** Writes failing unit tests based on the Architect's specs. Does not write implementation code.
4.  **The Mechanic (Green Phase):** Writes the minimal code required to make the Test-Pilot's tests pass.
5.  **The Refactor-Bot (Refactor Phase):** Optimizes and cleans up the code once tests are green, ensuring they stay green.
6.  **The DevOps Sentry (Automation):** Manages GitHub Actions, local hooks, and always ensures `npm run build` passes before push.

## **Part 3: Architectural Constraints**


**Copy and paste the following to your coding agent to begin:**

"I want to build Milestone 1 of a strategy simulation called 'Crown, Caravan, & Conquest'. Please follow these instructions and refer to the GDD for logic:

1. **Project Setup:** Create a single-file React component using Tailwind CSS and Lucide-React.  
2. **Hex Grid:** Generate a 10x10 hex grid using Axial coordinates. Randomly assign terrain types: Plains, Forest, Hills, and Mountains.  
3. **Metabolic Core:** \- Create a central 'Capital' settlement.  
   * Implement the Population cycle: Pop consumes 0.1 Food per tick.  
   * If Food Stockpile \> 0, Pop grows by 1% per tick.  
   * If Food Stockpile is 0, Pop starves (decreases by 2%).  
4. **Auto-Extraction:** Every tick, the settlement automatically gathers resources from its own hex and all 6 adjacent hexes based on the Terrain Yields (Plains \= Food, Forest \= Timber, Hills \= Stone, Mountains \= Ore).  
5. **UI Dashboard:**  
   * Display the visual map.  
   * Show a sidebar with Stockpiles, Population, and a 'Current Status' (Thriving/Starving).  
   * Add 'Play/Pause' and 'Reset' buttons.  
   * Use a dark-themed, professional aesthetic.

All state must be managed in a centralized 'worldState' object. Use a deterministic tick loop for all calculations."