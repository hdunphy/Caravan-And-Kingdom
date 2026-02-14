import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldState, Faction, Settlement } from '../types/WorldTypes';
import { DEFAULT_CONFIG } from '../types/GameConfig';
import { AIController } from '../simulation/ai/AIController';
import { UpgradeSystem } from '../simulation/systems/UpgradeSystem';
import { SettlementGovernor } from '../simulation/ai/SettlementGovernor';

describe('Rival Upgrade Logic', () => {
    let state: WorldState;
    let faction: Faction;
    let settlement: Settlement;
    let controller: AIController;

    beforeEach(() => {
        controller = new AIController();

        faction = {
            id: 'fa_rival',
            name: 'Rival Faction',
            color: '#ff0000',
            blackboard: {
                factionId: 'fa_rival',
                stances: { expand: 0.5, exploit: 1.0 }, // High Exploit -> Favor Upgrades
                criticalShortages: [],
                targetedHexes: [],
                desires: []
            }
        } as any;

        settlement = {
            id: 's_rival',
            name: 'Rival Village',
            ownerId: 'fa_rival',
            hexId: '0,0',
            population: 200, // Cap for Tier 0
            tier: 0,
            stockpile: {
                Food: 1000,
                Timber: 1000, // Plenty for upgrade
                Stone: 1000,  // Plenty for upgrade
                Ore: 1000,    // Added Ore to prevent Sovereign switching to EXPAND due to shortage
                Tools: 0,
                Gold: 0
            },
            controlledHexIds: ['0,0'],
            buildings: [],
            popHistory: [],
            availableVillagers: 0,
            jobCap: 100,
            workingPop: 100
        } as any;

        state = {
            tick: 100,
            map: {
                '0,0': { id: '0,0', coordinate: { q: 0, r: 0, s: 0 }, terrain: 'Plains', ownerId: 'fa_rival', resources: {} }
            },
            settlements: { 's_rival': settlement },
            agents: {},
            factions: { 'fa_rival': faction },
            width: 10,
            height: 10
        };
    });

    it('should generate UPGRADE ticket and execute it via AIController', () => {
        // 1. Run Governor to generate ticket
        SettlementGovernor.evaluate(settlement, faction, state, DEFAULT_CONFIG);

        // Verify ticket exists
        const tickets = faction.blackboard!.desires!;
        const upgradeTicket = tickets.find(t => t.type === 'UPGRADE');
        expect(upgradeTicket).toBeDefined();
        expect(upgradeTicket?.settlementId).toBe('s_rival');

        // 2. Run AIController (mocking resolveInstantDesires internal Logic by running update)
        // Actually AIController.resolveInstantDesires is private, but called by processFaction/update.
        // We can check if Tier increases.

        // We need to verify `UpgradeSystem.tryUpgrade` is called.
        // But since we are integration testing, we can just check the result.

        // However, AIController update relies on interval checks.
        // We can manually invoke the method if we cast to any, or just run update enough times?
        // Let's force it by exposing checking logic or ensuring tick triggers it.
        // AIController.update randomizes processing order and checks intervals.

        // Let's force-feed `resolveInstantDesires` if possible, OR just trust `update` if we handle the interval.
        // The interval is randomized.

        // EASIER: Just invoke the logic that `resolveInstantDesires` would do, OR verify `UpgradeSystem` integration separately?
        // No, we want to test AIController *integration*.

        // Let's check `processFaction` if we can access it? No, it's private.
        // `update` is public.

        // Spy on UpgradeSystem.tryUpgrade
        const upgradeSpy = vi.spyOn(UpgradeSystem, 'tryUpgrade');

        // Force tick to trigger update
        state.tick = 2000; // Arbitrary high number
        // AIController has internal state map `factionStates`. 
        // We might need to run it once to init, then again to update.

        controller.update(state, DEFAULT_CONFIG); // Init pass
        state.tick += 1000; // Advance time
        controller.update(state, DEFAULT_CONFIG); // Execute pass

        // Check if upgraded
        // Note: UpgradeSystem.tryUpgrade returns bool.
        // If it worked, tier should be 1.

        if (settlement.tier === 0) {
            // Maybe it didn't run due to probability?
            // Or maybe `UpgradeSystem` failed?
            // Let's check logs or verify spy.
        }

        // We expect it to TRY.
        expect(upgradeSpy).toHaveBeenCalled();

        // If logic is correct, it should have succeeded.
        expect(settlement.tier).toBe(1);
    });
});
