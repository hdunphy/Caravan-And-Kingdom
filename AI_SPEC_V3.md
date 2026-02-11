# AI Specification: Parallel Governor System (v3.0)

## **The Problem**
The current "Winner Takes All" logic causes "Priority Locking." If the AI has a 0.9 desire to Upgrade, it will ignore a 0.8 desire to Dispatch Villagers, even if those villagers are needed to *get* the resources for the upgrade. This leads to a total freeze in logic.

## **The Solution: Multi-Governor Architecture**
We will split the settlement's "Brain" into three independent Governors. Each Governor evaluates its specific desires and can execute one action per tick, allowing for parallel decision-making.

---

### **1. The HR Governor (Workforce & Logistics)**
**Manages:** `FOCUS` (Gather two specific resources), `SPREAD` (gather all resources), `SURVIVE` (Panic Food).
- **Core Loop:** Always busy. It ensures people are in the fields even while the town is building.
- **Winner:** Determines the best use of villagers based on the current state of the settlement, either focus on specific resources or spread out with a tiered approach based on the other governors' needs. If that resource is not available or ready to extract, we will alert the other governors to adjust their needs.

### **2. The Civil Governor (Spending & Construction)**
**Manages:** `BUILD` (Huts), `GROW` (Recruit), `EXPAND` (Settler), `ASCEND` (Upgrades), `FLEET` (Caravan production).
- **Core Loop:** Strategic. Usually involves spending large amounts of Timber/Stone.
- **Winner:** Picks one major project per x ticks (e.g., Build Gatherer's Hut) to target. The target will influence the other Governors' needs.

### **3. The Trade Governor (Commerce)**
**Manages:** `COMMERCIAL` (Buy/Sell).
- **Core Loop:** Market-driven. Scans for partners.
- **Winner:** Picks one trade route to initialize per tick.

---

## **Refined "Locking" Logic (Mutual Influence)**
To prevent them from fighting each other, we implement **Influence Flags**:
1.  **Material Lock:** If the Civil Governor is targeting an `ASCEND` goal, it sets a `High_Priority_Resource` flag (e.g., "Stone"). The HR Governor sees this flag and adds a **+0.5 bonus** to any `SPREAD` or `FOCUS` utility for Stone.
2.  **Gold Reserve:** If the Civil Governor is saving for a `FLEET`, it can temporarily lower the Trade Governor's `BUY` utility to prevent spending too much gold.
3.  **Survival Override:** If `SURVIVE` utility is > 0.8, it issues a **General Stand-Down**. The Civil and Trade governors' utilities are set to 0.0 until food security is restored.

## **Implementation Specs for AIController.ts**
- Group the strategies into these 3 Governor buckets.
- Iterate through each bucket independently.
- Sort actions *per bucket* by score.
- Execute the top 1 action from **each** bucket.
