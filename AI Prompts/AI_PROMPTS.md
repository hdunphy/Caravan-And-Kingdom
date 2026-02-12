# Utility AI Upgrade: Technical Execution Prompts (2026-02-10)

This document contains the specific prompts for the sub-agents to execute the **Utility-Based Desire System (v2.0)** on the `utility-ai` branch.

---

## **🏗️ The Architect (Handoff from PM)**
*   **Status:** DONE.
*   **Summary:** Translated PM rules into the `AI_SPEC.md` and defined the following prompt sequence.

---

## **🧪 The Test-Pilot (Red Phase Prompt)**
> "Hello Test-Pilot. We are implementing the Utility AI System defined in `AI_SPEC.md`. 
> 
> **Your Task:** Create a new test suite `src/tests/UtilityAI.test.ts`. 
> 1. **Unit Test - Desires:** Write tests for each of the 8 Utility logic blocks. 
>    - `SURVIVE` should return 1.0 when Food is 0.
>    - `ASCEND` should return 0.0 if any required resource is missing (0 Readiness).
>    - `COMMERCIAL` should return a higher score for selling a massive surplus vs a small one.
>    - `EXPAND` (Strategic) should return a score > 0 if a missing resource is found within 5 hexes.
> 2. **Integration Test - AIController:** Mock a WorldState where `SURVIVE` scores 1.0 and `EXPAND` scores 0.9. Verify that the AI Controller chooses the `GATHER_FOOD` action over spawning a `Settler`.
> 
> **Constraints:** Only write the test files. Use the existing `WorldState` and `GameConfig` types. The tests *should* fail initially as the logic is not yet implemented."

---

## **🔧 The Mechanic (Green Phase Prompt)**
> "Hello Mechanic. The Test-Pilot has provided a failing test suite in `src/tests/UtilityAI.test.ts`.
> 
> **Your Task:** Implement the logic required to pass these tests based on `AI_SPEC.md`.
> 1. **Refactor `AIController.ts`:** Update the `update()` loop to calculate scores for all 8 strategies.
> 2. **Implement Utility Classes:** Create/Refactor the strategy classes (`TradeStrategy`, `ExpansionStrategy`, etc.) to return `UtilityAction` objects containing both the action payload and a `score: number`.
> 3. **The Winner logic:** Ensure the `AIController` sorts actions by score and executes the top-ranked valid action.
> 4. **GameConfig Sync:** Add any new parameters mentioned in the formulas (like `criticalThresholdTicks` or `expansionStrategicRadius`) to `GameConfig.ts` and `DEFAULT_CONFIG`.
> 
> **Constraints:** Ensure the code compiles and passes `npm run build`."

---

## **✨ The Refactor-Bot (Optimization Prompt)**
> "Hello Refactor-Bot. The AI logic is now functional and passing tests.
> 
> **Your Task:** Optimize and clean the implementation.
> 1. **DRY Logic:** I expect significant overlap between `COMMERCIAL` and `PROVISION` logic. Abstract shared resource-scanning methods into a helper or a base class.
> 2. **Performance:** The Strategic Expansion scan (5-hex radius) could be heavy. Ensure it only runs once every `longCheckInterval` as defined in the config.
> 3. **Documentation:** Add JSDoc comments to the new utility formulas explaining the math behind the curves.
> 
> **Constraints:** Do not change the logic's behavior; only improve quality and performance. All tests must remain green."

---

## **🛡️ DevOps Sentry (Automation Prompt)**
> "Hello Sentry. 
> 
> **Your Task:** 
> 1. Run the full test suite (`npm test`) on the `utility-ai` branch.
> 2. Run `npm run build` and capture any linting or type errors.
> 3. **Notification:** Post a summary to the user including the test pass/fail rate and confirming that the build is stable.
> 4. If everything is green, let the PM know we are ready for a PR."
