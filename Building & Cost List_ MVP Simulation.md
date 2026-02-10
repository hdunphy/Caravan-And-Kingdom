# **MVP Building List: Crown, Caravan, & Conquest**

Buildings in the MVP serve as the physical nodes for the AI's "Brain" to interact with. They have a one-time construction cost and an ongoing maintenance cost (The Repair Loop).

## **1\. Settlement Tier Upgrades**

These are not single buildings but "Metabolic Shifts" for the entire settlement.

| Tier | Name | Cost | Benefit |
| :---- | :---- | :---- | :---- |
| **Tier 1** | **Village** | \- | 1 Hex Radius. Primary extraction focus. |
| **Tier 2** | **Town** | 500 Timber, 200 Stone | 2 Hex Radius. Unlocks Refineries. |
| **Tier 3** | **City** | 2k Timber, 1.5k Stone, 500 Ore | 3 Hex Radius. Unlocks Advanced Military & Administration. |

## **2\. Economic & Industrial Buildings**

These buildings transform raw materials into higher-value resources or "Sinks."

### **The Gatherer's Hut (Village Tier)**

* **Cost:** 50 Timber.  
* **Function:** Increases the yield of the hex it is built on by 20%.  
* **MVP Role:** Essential for AI to survive early food shortages.

### **The Warehouse (Town Tier)**

* **Cost:** 100 Timber, 50 Stone.  
* **Function:** Increases the settlement's storage cap for all resources.  
* **The Loop:** Without enough Warehouses, the AI loses surplus resources to "Spoilage" (a hard cap on growth).

### **Sawmill & Masonry (Town Tier)**

* **Cost:** 200 Timber / 200 Stone (respectively).  
* **Function:** Converts raw Timber into "Planks" or Stone into "Blocks."  
* **The Sink:** Planks and Blocks are required for **Tier 3** upgrades and Advanced Wall repairs.

### **The Smithy (Town Tier)**

* **Cost:** 150 Stone, 50 Ore.  
* **Function:** Produces **Tools** (consumes 5 Timber \+ 2 Ore per cycle).  
* **MVP Role:** This is the primary "Tool Loop" for AI optimization.

## **3\. Logistical & Security Buildings**

These buildings interact with the map agents (Caravans, Patrols, Raiders).

### **The Paved Road (Linear Structure)**

* **Cost:** 10 Stone per hex.  
* **Function:** Increases Caravan speed by 50%.  
* **Maintenance:** 1 Stone per 10 cycles. If not repaired, it reverts to a dirt path.

### **The Guard Post (Village/Town Tier)**

* **Cost:** 100 Timber, 20 Stone.  
* **Function:** Spawns and houses 1 **Patrol** unit.  
* **Upkeep:** 5 Gold \+ 5 Food per cycle.  
* **MVP Role:** The physical home for the AI's security forces.

### **The Watchtower (Village Tier)**

* **Cost:** 80 Stone.  
* **Function:** Provides "Fog of War" clearance and a 2.0x Defender Bonus to any unit standing on its hex.  
* **MVP Role:** Helps AI detect Raiders before they hit a trade route.

## **4\. Military & Governance (City Tier)**

Required for late-game simulation stability and conquest.

### **The Barracks**

* **Cost:** 500 Stone, 200 Ore.  
* **Function:** Required to equip "Advanced" gear on units.  
* **The Sink:** Consumes Ore every time a unit is "Re-equipped" after a battle.

### **The Market Hall**

* **Cost:** 300 Timber, 300 Stone.  
* **Function:** Increases Gold generation from population.  
* **MVP Role:** The engine that funds the high maintenance costs of a large empire.

### **The Palace / Seat of Power**

* **Cost:** 1k Stone, 500 Gold.  
* **Function:** Projects the **Loyalty Radius**.  
* **MVP Role:** The "Heart" of the faction; if destroyed or captured, the faction fragments or is annexed.