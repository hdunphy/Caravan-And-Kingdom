## **High Level AI Layered Approach**
* **The Goal:** Create a high-level AI system that can manage a kingdom of settlements. It will use tiers of layers to manage the kingdom. Starting from the faction level, down to the settlement level, and finally the agent level.
* **Important:** This is for reference only. I will add other prompts with more detailed instruction for implementation. Use this to help guide the implementation of the AI system, but do not skip ahead to any of the following milestones unless specifically told to do so.

### **Milestone 1: The Faction Blackboard & The Sovereign (Foundation)**

* **The Goal:** Create the "Faction Brain" that sets the tone for the entire kingdom.

* **Brainstorming Details:**

* *Strategic Stance:* We define the formulas for the King (e.g., If Faction Gold is < 500, set `STANCE_EXPLOIT` to 0.8).

* *The Data Structure:* We define the `Blackboard` object—a shared memory space that every settlement in the faction can read.



### **Milestone 2: The Governor Refactor (Ambition)**

* **The Goal:** Turn our current `GoalEvaluator` into a `SettlementGovernor` that posts "Desires" to the board.

* **Brainstorming Details:**

* *Desire Weighting:* We decide exactly how the King’s stance modifies a local village’s choices (e.g., `Base_Desire * King_Modifier`).

* *Role Impact:* How the **Settlement Roles** (Lumber Camp, etc.) prioritize these desires.



### **Milestone 3: The Planner & The Job Pool (Decomposition)**

* **The Goal:** Build the logic that breaks a high-level "Desire" (like `UPGRADE`) into a "To-Do List" (Jobs).

* **Brainstorming Details:**

* *The Job Schema:* We define the "Job Ticket" (ID, Priority, Type, Target Hex, Faction ID).

* *Action Recipes:* We define the checklist for each goal (e.g., `UPGRADE` ➡️ Check Stone ➡️ Create Gather Jobs).



### **Milestone 4: The Dispatcher (Bidding & Execution)**

* **The Goal:** The "Ant Brain." How individual agents autonomously pick which job to do.

* **Brainstorming Details:**

* *The Bidding Formula:* We tune the math for selecting jobs: `Utility = Job_Priority / (Distance + Fatigue)`.

* *Reservation Logic:* How to prevent two agents from "claiming" the same job ticket.



### **Milestone 5: The Visualizer (Control & Debugging)**

* **The Goal:** Update the UI so you can monitor the Blackboard and Job Pool in real-time.

* **Details:** Building a "Live Feed" of the King's stance and pending jobs so you can see where the logic is succeeding or failing.