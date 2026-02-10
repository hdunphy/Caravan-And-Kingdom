# Caravan & Kingdom Team Workflow (Updated 2026-02-10)

## The Team Lifecycle (TDD Loop)

1.  **Patrick the PM (Manager):** Brainstorms with Lord Dunphy to create high-level technical specs and plans.
2.  **The Architect (Planning):** Translates specs into detailed AI prompts and defines expected behaviors for other agents.
3.  **The Test-Pilot (Red Phase):** Writes failing unit tests based on the Architect's specs. Does not write implementation code.
4.  **The Mechanic (Green Phase):** Writes the minimal code required to make the Test-Pilot's tests pass.
5.  **The Refactor-Bot (Refactor Phase):** Optimizes and cleans up the code once tests are green, ensuring they stay green.
6.  **The DevOps Sentry (Automation):** Manages GitHub Actions, local hooks, and automates the testing notification loop.

## Workspace Defaults
- **Root:** `/mnt/c/Users/hdunp/Documents/GameDev/Unity/GitHub/Caravan and Kingdom`
- **Tests:** `caravan-react/src/tests`
- **Source:** `caravan-react/src`
