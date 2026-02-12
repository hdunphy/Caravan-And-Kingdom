# Task Prompt: AI Governor Split (Labor vs. Transport)

## **1. Context**
The current **HR Governor** is experiencing "Priority Locking." High-scoring Caravan actions are blocking Villager actions from ever executing, leaving our 100+ workforce idle while Caravans do all the work.

## **2. Your Objective**
Refactor the `AIController.ts` to split the AI into **four** specialized Governors to ensure parallel execution of workforce and fleet management.

---

## **3. Technical Requirements**

### **A. Four-Governor Architecture**
Update the `runGovernor` loop to handle the following distinct roles:
1.  **CIVIL:** (Building Huts, Upgrades, Spawning Settlers).
2.  **LABOR:** (Recruiting Villagers, Dispatching Villagers to remote hexes).
3.  **TRANSPORT:** (Building Caravans, Dispatching Caravans for **Internal Logistics/Freight**).
4.  **TRADE:** (Dispatching Caravans for **Commercial Trade**).

### **B. Normalization Fix (Crucial)**
The `VillagerStrategy.ts` currenty divides its final score by 100 (`provScore / 100.0`), while `LogisticsStrategy.ts` does not. 
- Ensure both strategies use the same utility scale (0.0 to 1.0).
- A Villager picking up 20 Stone should have a similar utility score to a Caravan picking up 50 Stone, adjusted only by their relative efficiency/cost.

### **C. Relocation of Actions**
- Move `RECRUIT_VILLAGER` from the **Civil** governor to the **Labor** governor. 
- Ensure `BUILD_CARAVAN` is managed by the **Transport** governor.

### **D. Priority Influence**
- Ensure the **Labor Governor** still respects the `focusResources` flags set by the **Civil Governor** (e.g., if we are saving for an upgrade, Villagers should prioritize those materials).

---

## **4. Handoff Checklist**
1.  Verify `AIController.ts` now executes **one action per governor** (up to 4 actions per tick).
2.  Check `AITypes.ts` for any missing action categories.
3.  Update tests to verify that a Villager can be dispatched in the same tick that a Caravan is sent for trade.
4.  Run `npm run build` to verify type integrity.
