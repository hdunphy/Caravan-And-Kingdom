# **GDD: Crown, Caravan, & Conquest (v2.0)**

## **1\. Executive Summary**

**Crown, Caravan, & Conquest** is a "Live World" strategy simulation where empires are emergent physical systems. Unlike traditional 4X games, there are no teleporting resources or abstract construction menus. Every action is a physical process: resources are extracted, transported by vulnerable agents, and consumed by ongoing maintenance sinks. The game focuses on the organic rise and fall of nations driven by logistics, geography, and AI "personalities."

## **2\. The Core Economy & Resource Cycles**

The economy is built on a "Sinks and Sources" model. No resource is purely for stockpiling; every material is required to keep the simulation running.

### **2.1 Resource Taxonomy**

| Resource | Primary Source | Maintenance Sink (Ongoing) | Strategic Use |
| :---- | :---- | :---- | :---- |
| **Food** | Plains / Water | **Survival:** Consumed per Pop cycle. | Drives growth & Army Morale. |
| **Timber** | Forest | **Logistics:** Repairs Caravans & Tools. | Vital for trade movement & construction. |
| **Stone** | Hills | **Infrastructure:** Repairs Roads/Walls. | Allows tier upgrades & defense. |
| **Ore** | Mountains | **Military:** Equipment upkeep. | Required for "Advanced" gear. |
| **Gold** | Trade / Taxes | **Wages:** Pays Patrols & Army Morale. | Lubricates specialized labor. |
| **Tools** | Manufactured | **Efficiency:** Consumed by Extractors. | Buffs all hex yields (+20%). |
| **Salt** | Salt Flats | **Logistics:** Added to Caravans. | Reduces food decay on long routes. |

### **2.2 The "Repair Loop" (Infrastructure Decay)**

Structures and roads possess **Integrity**. Every cycle, a percentage of Stone and Timber is consumed from the settlement stockpile to perform repairs.

* **Roads:** Require Stone. Decayed roads slow Caravans by 50%.  
* **Walls:** Require Stone/Timber. Decayed walls provide 0 Defense Bonus.  
* **Caravans:** Have a "Service Life." Replacing them requires Timber.

## **3\. The Physical World: Agents & Logistics**

Resources exist only at their physical location or within an **Agent**.

* **Caravans:** The lifeblood of the empire. They physically move cargo between hexes. They are vulnerable to raiding.  
* **Supply Tethers:** Armies must be followed by a **Supply Train** (Food/Gold Caravans). If the tether is severed, the army suffers the "Starvation" debuff (-50% CS).  
* **Paved Roads:** A linear infrastructure that costs Stone to build and maintain. Roads override terrain penalties and grant a 1.5x speed boost.

## **4\. The AI Brain: Utility & Personalities**

The AI uses a **Tiered Utility Architecture** to manage its faction autonomously.

### **4.1 Tiered Architecture**

1. **Sovereign (Strategy):** High-level goals (e.g., "Expand East," "Prepare for War").  
2. **Governor (Management):** Allocates Pop to specific hexes to meet Sovereign goals.  
3. **Agent (Execution):** Individual units performing A\* pathfinding and tasks.

### **4.2 Archetypes (Personalities)**

* **The Expansionist:** Values distance lower in Utility Scores; settles aggressively and tolerates lower Stability.  
* **The Perfectionist:** High weight on Maintenance and Tools; stays small but maximizes Combat Strength.  
* **The Merchant:** Maintains 2x Caravan count; prioritizes Water/Trade and uses Gold to reset "Grievances."  
* **The Opportunist:** Lowers the War threshold; prioritizes Raiders over Patrols.

## **5\. Diplomacy & Friction**

* **Grievance System:** A dynamic meter (0-100). Increased by **Encroachment** (+1/tick), **Raiding** (+50), or **Border Pursuits**.  
* **States:**  
  * **Trade Agreement:** Mutual access; \+Stability; shared "Green-list" for Caravans.  
  * **Neutral:** The "Grey Zone." Caravans can pass but generate Friction. Raiding is possible.  
  * **War:** Triggered when Grievance \> threshold and Power Rating ratio \> 1.5x.

## **6\. Combat: The "Drain" Mechanic**

Battles are physical "clinches" that drain resources over time.

### **6.1 Combat Strength (CS) Formula**

* **Equipment:** Unarmed (1.0x), Basic (1.5x \- Timber), Advanced (2.5x \- Ore).  
* **Morale:** Buffed by Food/Gold surpluses; debuffed by Starvation (-50%).  
* **Terrain:** Hills/Walls (2.0x Defender), Forest (1.2x Defender), River Crossing (0.7x Attacker).

### **6.2 Resolution**

Engaged units lose **Population** and **Morale** every cycle. When Morale hits 20%, the unit **Routes**, fleeing toward the nearest friendly city at double food consumption.

## **7\. Emergent Lifecycle: Collapse & Regeneration**

* **Stability & Loyalty:** Distance from the Capital decreases Loyalty. High food deficits trigger **Splintering**, where a town becomes an Independent City-State.  
* **Refugees:** War/Starvation creates "Refugee" agents that flee toward stable, food-positive neighbors.  
* **Environmental Scarring:** Intensive extraction temporarily lowers hex yields, forcing the AI to migrate its industry.

## **8\. Terrain & Yields**

| Terrain | Primary | Secondary | Strategic Note |
| :---- | :---- | :---- | :---- |
| **Plains** | Food (High) | Timber (Low) | Pop growth center; easy to raid. |
| **Forest** | Timber (High) | Hides | Logistics hub; defender bonus. |
| **Hills** | Stone (High) | Ore (Low) | Maintenance source; high ground. |
| **Mountain** | Ore (High) | Stone | Military tech source; bottleneck. |
| **Water** | Food (Fish) | Gold | High-speed trade; zero building space. |

