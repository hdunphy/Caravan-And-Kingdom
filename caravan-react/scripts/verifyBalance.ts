import { createInitialState } from '../src/simulation/WorldState';
import { GameLoop } from '../src/simulation/GameLoop';
import { DEFAULT_CONFIG } from '../src/types/GameConfig';
import { HexUtils } from '../src/utils/HexUtils';

// Mock Config for Speed
const config = { ...DEFAULT_CONFIG };
config.simulation.resourceTickInterval = 1;

// Use the new values directly to ensure test reflects them even if import is stale
config.costs.growthRate = 0.006;
config.costs.baseConsume = 0.1;
config.yields.Plains.Food = 4.0;

const state = createInitialState();
// Setup: Capital at 5,5 with 100 pop
state.settlements['capital'] = {
    id: 'capital',
    name: 'Capital',
    hexId: '5,5',
    population: 100,
    ownerId: 'player_1',
    integrity: 100,
    tier: 0,
    resourceChange: {},
    workingPop: 100,
    jobCap: 100,
    controlledHexIds: ['5,5', '6,5', '5,6', '4,6', '4,5', '5,4', '6,4'],
    stockpile: { Food: 0, Timber: 0, Stone: 0, Ore: 0, Gold: 0, Tools: 0 } // Start empty to track gain
};

// Setup Map: Ensure 2 Plains
// 5,5 is center. Neighbors: 6,5 (E), 5,6 (SE), 4,6 (SW), 4,5 (W), 5,4 (NW), 6,4 (NE)
// Let's force two neighbors to be Plains
const map = state.map; // Assuming createInitialState makes an empty map? No, it's empty.
// We need a mock map.
state.map = {};
const center = { q: 5, r: 0, s: -5 }; // HexCoordinate
state.map['5,0'] = { id: '5,0', coordinate: center, terrain: 'Plains', ownerId: 'player_1', resources: {} };

const n1 = { q: 6, r: 0, s: -6 };
state.map['6,0'] = { id: '6,0', coordinate: n1, terrain: 'Plains', ownerId: 'player_1', resources: {} };

const n2 = { q: 4, r: 1, s: -5 };
state.map['4,1'] = { id: '4,1', coordinate: n2, terrain: 'Plains', ownerId: 'player_1', resources: {} };

const n3 = { q: 5, r: 1, s: -6 };
state.map['5,1'] = { id: '5,1', coordinate: n3, terrain: 'Hills', ownerId: 'player_1', resources: {} }; // For Stone

// Update Settlement Hex
state.settlements['capital'].hexId = '5,0';

const loop = new GameLoop(state, config);

console.log("Starting Simulation...");
console.log(`Target: Upgrade to Town (Tier 1)`);
console.log(`Costs: Timber: ${config.upgrades.villageToTown.costTimber}, Stone: ${config.upgrades.villageToTown.costStone}`);
console.log(`Initial Labor: Pop ${state.settlements['capital'].population} | Working ${state.settlements['capital'].workingPop}/${state.settlements['capital'].jobCap}`);

let upgraded = false;
let ticks = 0;
const MAX_TICKS = 1000;

for (let i = 0; i < MAX_TICKS; i++) {
    loop.tick();
    ticks++;

    if (state.settlements['capital'].tier === 1) {
        upgraded = true;
        break;
    }
}

if (upgraded) {
    console.log(`SUCCESS: Upgraded to Town in ${ticks} ticks.`);
} else {
    console.log(`FAILURE: Did not upgrade in ${MAX_TICKS} ticks.`);
    console.log("Final Resources:", state.settlements['capital'].stockpile);
}

