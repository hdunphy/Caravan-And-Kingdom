// src/simulation/evolution/EvolutionWorker.ts
import { parentPort } from "worker_threads";

// src/simulation/WorldState.ts
var createInitialState = () => {
  const playerFaction = {
    id: "player_1",
    name: "Player Empire",
    color: "#3b82f6"
    // Blue-500
  };
  return {
    tick: 0,
    map: {},
    settlements: {},
    agents: {},
    factions: {
      "player_1": playerFaction,
      "rival_1": {
        id: "rival_1",
        name: "The Iron Pact",
        color: "#ef4444",
        // Red
        type: "AI"
      }
    },
    width: 10,
    height: 10
  };
};

// src/utils/HexUtils.ts
var HexUtils = {
  // Create a coordinate
  create(q, r) {
    return { q, r, s: -q - r };
  },
  // Get ID string
  getID(hex) {
    return `${hex.q},${hex.r}`;
  },
  // Get neighbors (Axial directions)
  getNeighbors(hex) {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];
    return directions.map((d) => HexUtils.create(hex.q + d.q, hex.r + d.r));
  },
  // Distance between two hexes
  distance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  },
  // Convert Hex to Pixel (Pointy Top)
  hexToPixel(hex, size) {
    const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
    const y = size * (3 / 2 * hex.r);
    return { x, y };
  },
  // Get all hexes within a certain radius (N rings)
  getSpiral(center, radius) {
    const results = [];
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        results.push(HexUtils.create(center.q + q, center.r + r));
      }
    }
    return results;
  }
};

// src/simulation/MapGenerator.ts
var MapGenerator = {
  generate(width, height) {
    const map = {};
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        const q_axial = q - Math.floor(r / 2);
        const r_axial = r;
        const coord = HexUtils.create(q_axial, r_axial);
        const cell = {
          id: HexUtils.getID(coord),
          coordinate: coord,
          terrain: this.getRandomTerrain(),
          ownerId: null,
          resources: {}
        };
        map[cell.id] = cell;
      }
    }
    return map;
  },
  getRandomTerrain() {
    const rand = Math.random();
    if (rand < 0.3) return "Plains";
    if (rand < 0.5) return "Forest";
    if (rand < 0.7) return "Hills";
    if (rand < 0.85) return "Mountains";
    return "Water";
  },
  findStartingLocation(map, _width, _height, config, existingSettlements) {
    const candidates = Object.values(map);
    candidates.sort(() => Math.random() - 0.5);
    const requiredFood = (config.yields.Plains.Food || 1) * 3;
    for (const cell of candidates) {
      if (cell.terrain === "Water") continue;
      if (cell.ownerId) continue;
      const cityRange = 3;
      const spiral = HexUtils.getSpiral(cell.coordinate, cityRange);
      const allInBounds = spiral.every((c) => map[HexUtils.getID(c)]);
      if (!allInBounds) continue;
      const tooClose = existingSettlements.some((s) => {
        const sHex = map[s.hexId];
        if (!sHex) return false;
        return HexUtils.distance(cell.coordinate, sHex.coordinate) <= cityRange;
      });
      if (tooClose) continue;
      const innerRing = HexUtils.getSpiral(cell.coordinate, 1);
      let totalFood = 0;
      let totalTimber = 0;
      let totalStone = 0;
      innerRing.forEach((c) => {
        const h = map[HexUtils.getID(c)];
        if (h) {
          const y = config.yields[h.terrain];
          if (y) {
            totalFood += y.Food || 0;
            totalTimber += y.Timber || 0;
            totalStone += y.Stone || 0;
          }
        }
      });
      if (totalFood >= requiredFood && totalTimber > 0 && totalStone > 0) {
        return cell;
      }
    }
    return null;
  },
  findExpansionLocation(map, _width, _height, config, existingSettlements) {
    const candidates = [];
    const requiredFood = (config.yields.Plains.Food || 1) * 1.5;
    Object.values(map).forEach((cell) => {
      if (cell.terrain === "Water") return;
      if (existingSettlements.some((s) => s.hexId === cell.id)) return;
      const neighbors = HexUtils.getSpiral(cell.coordinate, 1);
      const allInBounds = neighbors.every((c) => map[HexUtils.getID(c)]);
      if (!allInBounds) return;
      const tooClose = existingSettlements.some((s) => {
        const sHex = map[s.hexId];
        if (!sHex) return false;
        return HexUtils.distance(cell.coordinate, sHex.coordinate) <= 2;
      });
      if (tooClose) return;
      let totalFood = 0;
      neighbors.forEach((c) => {
        const h = map[HexUtils.getID(c)];
        if (h && config.yields[h.terrain]) {
          totalFood += config.yields[h.terrain].Food || 0;
        }
      });
      if (totalFood >= requiredFood) {
        candidates.push(cell);
      }
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
};

// src/simulation/systems/MetabolismSystem.ts
var MetabolismSystem = {
  update(state, config, silent = false) {
    Object.values(state.settlements).forEach((settlement) => {
      const pop = settlement.population;
      const foodConsumption = pop * config.costs.baseConsume;
      const hexCount = settlement.controlledHexIds.length || 7;
      const maxJobs = hexCount * config.costs.maxLaborPerHex;
      const workingPop = Math.min(pop, maxJobs);
      if (settlement.stockpile.Food >= foodConsumption) {
        const surplus = settlement.stockpile.Food - foodConsumption;
        settlement.stockpile.Food = surplus;
        const pressureFactor = pop > 0 ? workingPop / pop : 1;
        const settlementCost = config.costs.agents.Settler.Food || 500;
        let surplusBonus = 0;
        if (settlement.stockpile.Food > settlementCost) {
          const extra = settlement.stockpile.Food - settlementCost;
          const surplusRatio = foodConsumption > 0 ? extra / foodConsumption : 0;
          surplusBonus = surplusRatio * (config.costs.growthSurplusBonus || 1e-4);
        }
        const baseGrowth = config.costs.growthRate || 8e-3;
        let finalGrowthRate = (baseGrowth + surplusBonus) * pressureFactor;
        let cap = config.upgrades.villageToTown.popCap || 200;
        if (settlement.tier === 1) cap = config.upgrades.townToCity.popCap || 500;
        if (settlement.tier >= 2) cap = config.upgrades.city?.popCap || 2e3;
        if (settlement.population >= cap) {
          finalGrowthRate *= 0.1;
        }
        settlement.population += pop * finalGrowthRate;
        settlement.lastGrowth = pop * finalGrowthRate;
      } else {
        settlement.stockpile.Food = 0;
        const starvationLoss = pop * (config.costs.starvationRate || 5e-3);
        settlement.population -= starvationLoss;
        settlement.lastGrowth = -starvationLoss;
      }
      settlement.population = Math.max(0, settlement.population);
      if (!settlement.popHistory) settlement.popHistory = [];
      settlement.popHistory.push(settlement.population);
      if (settlement.popHistory.length > 100) settlement.popHistory.shift();
      const taxRate = config.economy?.taxRate || 5e-3;
      settlement.stockpile.Gold += settlement.population * taxRate;
      if (settlement.population <= 0) {
        if (!silent) console.log(`[DEATH] Settlement ${settlement.name} has died out.`);
        if (settlement.controlledHexIds) {
          settlement.controlledHexIds.forEach((id) => {
            if (state.map[id]) state.map[id].ownerId = null;
          });
        }
        delete state.settlements[settlement.id];
      }
    });
  }
};

// src/simulation/systems/ExtractionSystem.ts
var ExtractionSystem = {
  update(state, config) {
    Object.values(state.settlements).forEach((settlement) => {
      const centerHexId = settlement.hexId;
      const centerHex = state.map[centerHexId];
      if (!centerHex) return;
      let hasTools = settlement.stockpile.Tools >= 1;
      const toolMult = hasTools ? config.costs.toolBonus : 1;
      if (hasTools) {
        if (Math.random() < config.costs.toolBreakChance) {
          settlement.stockpile.Tools = Math.max(0, settlement.stockpile.Tools - 1);
        }
      }
      settlement.controlledHexIds.forEach((hexId) => {
        const hex = state.map[hexId];
        if (!hex) return;
        const utilization = 1;
        this.extractFromHex(state, settlement, hexId, hex.terrain, config, toolMult, utilization);
      });
    });
  },
  extractFromHex(state, settlement, hexId, terrain, config, toolMult, utilization) {
    const yieldData = config.yields[terrain];
    if (!yieldData) return;
    let buildingMult = 1;
    if (settlement.buildings) {
      const building = settlement.buildings.find((b) => b.hexId === hexId);
      if (building && building.integrity > 0) {
        const buildConfig = config.buildings[building.type];
        if (buildConfig && buildConfig.effects) {
          buildConfig.effects.forEach((effect) => {
            if (effect.type === "YIELD_BONUS") {
              buildingMult += effect.value;
            }
          });
        }
      }
    }
    const totalMult = utilization * toolMult * buildingMult;
    Object.entries(yieldData).forEach(([resource, amount]) => {
      const yieldAmount = amount * totalMult;
      if (resource === "Gold") {
        const faction = state.factions[settlement.ownerId];
        if (faction) {
          faction.gold = (faction.gold || 0) + yieldAmount;
        }
      } else {
        if (hexId === settlement.hexId) {
          settlement.stockpile[resource] += yieldAmount;
        } else {
          const mapHex = state.map[hexId];
          if (mapHex) {
            if (!mapHex.resources) mapHex.resources = {};
            mapHex.resources[resource] = (mapHex.resources[resource] || 0) + yieldAmount;
          }
        }
      }
    });
  }
};

// src/simulation/Pathfinding.ts
var pathCache = /* @__PURE__ */ new Map();
var Pathfinding = {
  clearCache() {
    pathCache.clear();
  },
  findPath(start, end, map, config) {
    const startId = HexUtils.getID(start);
    const endId = HexUtils.getID(end);
    const cacheKey = `${startId}_${endId}`;
    if (pathCache.has(cacheKey)) {
      return pathCache.get(cacheKey);
    }
    const costs = config?.costs.terrain || {
      Plains: 1,
      Forest: 2,
      Hills: 3,
      Mountains: 6,
      Water: 1e3
    };
    const IMPASSABLE = 1e3;
    if (startId === endId) return [];
    const endCell = map[endId];
    if (!endCell) return null;
    const endCost = costs[endCell.terrain];
    if (endCost >= IMPASSABLE) return null;
    const openList = [];
    const closedSet = /* @__PURE__ */ new Set();
    const startNode = {
      id: startId,
      coord: start,
      g: 0,
      h: HexUtils.distance(start, end),
      f: HexUtils.distance(start, end),
      parent: null
    };
    openList.push(startNode);
    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift();
      if (current.id === endId) {
        const path = [];
        let curr = current;
        while (curr) {
          path.push(curr.coord);
          curr = curr.parent;
        }
        const resultPath = path.reverse().slice(1);
        pathCache.set(cacheKey, resultPath);
        return resultPath;
      }
      closedSet.add(current.id);
      const neighbors = HexUtils.getNeighbors(current.coord);
      for (const neighborCoord of neighbors) {
        const neighborId = HexUtils.getID(neighborCoord);
        const neighborCell = map[neighborId];
        if (!neighborCell || closedSet.has(neighborId)) continue;
        const cost = costs[neighborCell.terrain];
        if (cost >= IMPASSABLE) continue;
        const gScore = current.g + cost;
        const existingNode = openList.find((n) => n.id === neighborId);
        if (existingNode) {
          if (gScore < existingNode.g) {
            existingNode.g = gScore;
            existingNode.f = gScore + existingNode.h;
            existingNode.parent = current;
          }
        } else {
          const h = HexUtils.distance(neighborCoord, end);
          openList.push({
            id: neighborId,
            coord: neighborCoord,
            g: gScore,
            h,
            f: gScore + h,
            parent: current
          });
        }
      }
    }
    pathCache.set(cacheKey, []);
    return null;
  }
};

// src/simulation/systems/VillagerSystem.ts
var VillagerSystem = {
  update(state, config) {
    const agentsToRemove = [];
    const agents = Object.values(state.agents).filter((a) => a.type === "Villager");
    agents.forEach((agent) => {
      if (!agent.homeId || !state.settlements[agent.homeId]) {
        agentsToRemove.push(agent.id);
        return;
      }
      const home = state.settlements[agent.homeId];
      if (agent.path && agent.path.length > 0) {
        return;
      }
      switch (agent.status) {
        case "IDLE":
          if (HexUtils.getID(agent.position) !== home.hexId) {
            this.returnHome(state, agent, config);
          }
          break;
        case "BUSY":
          this.handleGather(state, agent, config);
          break;
        case "RETURNING":
          this.handleReturn(state, agent, home);
          break;
      }
    });
    agentsToRemove.forEach((id) => delete state.agents[id]);
  },
  handleGather(state, agent, config) {
    if (!agent.gatherTarget) {
      this.returnHome(state, agent, config);
      return;
    }
    const currentHexId = HexUtils.getID(agent.position);
    const targetHexId = HexUtils.getID(agent.gatherTarget);
    if (currentHexId === targetHexId) {
      const hex = state.map[currentHexId];
      if (hex && hex.resources) {
        const capacity = config.costs.villagers?.capacity || 20;
        let currentLoad = Object.values(agent.cargo).reduce((a, b) => a + b, 0);
        const space = capacity - currentLoad;
        if (space > 0) {
          for (const [res, amount] of Object.entries(hex.resources)) {
            if (amount > 0 && space > 0) {
              const take = Math.min(amount, space);
              agent.cargo[res] = (agent.cargo[res] || 0) + take;
              hex.resources[res] -= take;
              break;
            }
          }
        }
      }
      this.returnHome(state, agent, config);
    } else {
      const targetHex = state.map[HexUtils.getID(agent.gatherTarget)];
      if (targetHex) {
        const path = Pathfinding.findPath(agent.position, targetHex.coordinate, state.map, config);
        if (path) {
          agent.path = path;
          agent.target = targetHex.coordinate;
          agent.activity = "MOVING";
        } else {
          this.returnHome(state, agent, config);
        }
      }
    }
  },
  handleReturn(state, agent, home) {
    const currentHexId = HexUtils.getID(agent.position);
    if (currentHexId === home.hexId) {
      for (const [res, amount] of Object.entries(agent.cargo)) {
        if (amount > 0) {
          home.stockpile[res] += amount;
          agent.cargo[res] = 0;
        }
      }
      agent.status = "IDLE";
      agent.mission = "IDLE";
      agent.activity = "IDLE";
      agent.gatherTarget = void 0;
      home.availableVillagers++;
      delete state.agents[agent.id];
    } else {
    }
  },
  returnHome(state, agent, config) {
    if (!agent.homeId) return;
    const home = state.settlements[agent.homeId];
    if (!home) return;
    const homeHex = state.map[home.hexId];
    const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config);
    if (path) {
      agent.path = path;
      agent.target = homeHex.coordinate;
      agent.status = "RETURNING";
      agent.activity = "MOVING";
    } else {
      delete state.agents[agent.id];
      home.availableVillagers++;
    }
  },
  // Called by GovernorAI
  spawnVillager(state, settlementId, targetHexId, config) {
    const settlement = state.settlements[settlementId];
    if (!settlement || settlement.availableVillagers <= 0) return null;
    const startHex = state.map[settlement.hexId];
    const targetHex = state.map[targetHexId];
    if (!startHex || !targetHex) return null;
    let path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);
    if (targetHexId === settlement.hexId) {
      path = [startHex.coordinate];
    }
    if (!path || path.length === 0) return null;
    settlement.availableVillagers--;
    const id = `villager_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agent = {
      id,
      type: "Villager",
      ownerId: settlement.ownerId,
      homeId: settlement.id,
      position: startHex.coordinate,
      target: targetHex.coordinate,
      path,
      cargo: {},
      integrity: 100,
      status: "BUSY",
      activity: "MOVING",
      mission: "GATHER",
      gatherTarget: targetHex.coordinate
    };
    state.agents[id] = agent;
    return agent;
  }
};

// src/simulation/systems/MovementSystem.ts
var MovementSystem = {
  update(state, config) {
    Object.values(state.agents).forEach((agent) => {
      if (!agent.path || agent.path.length === 0) return;
      if (agent.waitTicks && agent.waitTicks > 0) {
        return;
      }
      const nextStep = agent.path[0];
      const cellId = HexUtils.getID(nextStep);
      const cell = state.map[cellId];
      if (!cell) {
        agent.path = [];
        return;
      }
      const costs = config.costs.terrain || { Plains: 1, Forest: 2, Hills: 3, Mountains: 6, Water: 1 };
      const moveCost = costs[cell.terrain] || 1;
      const speed = config.costs.movement || 1;
      if (agent.movementProgress === void 0) agent.movementProgress = 0;
      agent.movementProgress += speed;
      if (agent.movementProgress >= moveCost) {
        agent.position = nextStep;
        agent.path.shift();
        if (agent.type === "Caravan") {
          const loss = config.costs.logistics?.caravanIntegrityLossPerHex || 0.5;
          agent.integrity = Math.max(0, agent.integrity - loss);
        }
        agent.movementProgress -= moveCost;
        if (agent.path.length === 0 && agent.target) {
          agent.target = null;
          agent.movementProgress = 0;
        }
      }
    });
  }
};

// src/simulation/systems/CaravanSystem.ts
var CaravanSystem = {
  // Determine spawn location (Settlement or from IDLE pool)
  spawn(state, startHexId, targetHexId, type = "Caravan", config) {
    const startHex = state.map[startHexId];
    const targetHex = state.map[targetHexId];
    if (!startHex || !targetHex) return null;
    const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);
    if ((!path || path.length === 0) && startHexId !== targetHexId) return null;
    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let agent;
    const base = {
      id,
      ownerId: "player_1",
      position: startHex.coordinate,
      target: targetHex.coordinate,
      path: path || [],
      cargo: {},
      integrity: 100,
      activity: "MOVING",
      status: "BUSY",
      waitTicks: 0
    };
    if (type === "Caravan") {
      agent = { ...base, type: "Caravan", mission: "IDLE" };
    } else if (type === "Settler") {
      agent = { ...base, type: "Settler" };
    } else if (type === "Villager") {
      agent = { ...base, type: "Villager", homeId: "temp", mission: "IDLE" };
    } else {
      agent = { ...base, type: "Caravan" };
    }
    state.agents[id] = agent;
    return agent;
  },
  processTrade(state, config) {
    Object.values(state.settlements).forEach((source) => {
      if (source.stockpile.Gold < 1) return;
      const goal = source.currentGoal || "TOOLS";
      let deficits = [];
      if (goal === "UPGRADE") {
        const nextTier = source.tier + 1;
        const cost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
        if (source.stockpile.Timber < cost.costTimber) deficits.push("Timber");
        if (source.stockpile.Stone < cost.costStone) deficits.push("Stone");
        if ("costOre" in cost && source.stockpile.Ore < cost.costOre) deficits.push("Ore");
      } else if (goal === "EXPAND") {
        const cost = config.costs.agents.Settler;
        if (source.stockpile.Food < (cost.Food || 500)) deficits.push("Food");
        if (source.stockpile.Timber < (cost.Timber || 200)) deficits.push("Timber");
      } else if (goal === "SURVIVE") {
        const consumption = Math.max(5, source.population * config.costs.baseConsume);
        if (source.stockpile.Food < consumption * 50) deficits.push("Food");
      } else if (goal === "TOOLS") {
        if (source.stockpile.Timber < 100) deficits.push("Timber");
        if (source.stockpile.Ore < 50) deficits.push("Ore");
      }
      if (deficits.length === 0) return;
      const neededRes = deficits[0];
      const potentialTargets = Object.values(state.settlements).filter((t) => t.id !== source.id);
      const target = potentialTargets.find((t) => {
        const tCons = Math.max(5, t.population * config.costs.baseConsume);
        const surplusThreshold = neededRes === "Food" ? tCons * 20 : 100;
        return t.stockpile[neededRes] > surplusThreshold;
      });
      if (target) {
        const existingRoute = Object.values(state.agents).find(
          (a) => a.type === "Caravan" && a.ownerId === source.ownerId && a.mission === "TRADE" && a.targetSettlementId === target.id && a.tradeResource === neededRes
        );
        if (existingRoute) return;
        const goldPerRes = config.costs.trade?.simulatedGoldPerResource || 1;
        const capacity = config.costs.trade?.capacity || 50;
        const afford = Math.floor(source.stockpile.Gold / goldPerRes);
        const amount = Math.min(capacity, afford, target.stockpile[neededRes]);
        const tradeValue = amount * goldPerRes;
        const roiThreshold = config.costs.logistics?.tradeRoiThreshold || 20;
        if (tradeValue >= roiThreshold) {
          this.dispatch(state, source, target.hexId, "TRADE", config, {
            targetId: target.id,
            resource: neededRes,
            gold: amount * goldPerRes,
            value: amount * goldPerRes
          });
        }
      }
    });
  },
  forceTrade(state, config) {
    Object.values(state.settlements).forEach((source) => {
      const resources = ["Food", "Timber", "Stone", "Ore"];
      const neededRes = resources[Math.floor(Math.random() * resources.length)];
      const potentialTargets = Object.values(state.settlements).filter((t) => t.id !== source.id);
      if (potentialTargets.length > 0) {
        const target = potentialTargets[0];
        this.dispatch(state, source, target.hexId, "TRADE", config, {
          targetId: target.id,
          resource: neededRes,
          gold: config.costs.trade.forceTradeGold || 50
        });
      }
    });
  },
  dispatch(state, settlement, targetHexId, mission, config, context) {
    let agent = Object.values(state.agents).find(
      (a) => a.type === "Caravan" && a.ownerId === settlement.ownerId && a.status === "IDLE" && a.homeId === settlement.id
    );
    if (!agent) {
      const constructionThreshold = mission === "TRADE" ? config.costs.logistics?.constructionRoiThreshold || 50 : config.costs.logistics?.freightConstructionThreshold || 100;
      const value = context.value || 0;
      if (value < constructionThreshold) {
        return null;
      }
      const cost = config.costs.agents.Caravan.Timber || 50;
      if (settlement.stockpile.Timber >= cost) {
        settlement.stockpile.Timber -= cost;
        agent = this.spawn(state, settlement.hexId, targetHexId, "Caravan", config) || void 0;
        if (agent && agent.type === "Caravan") {
          agent.ownerId = settlement.ownerId;
          agent.homeId = settlement.id;
        }
      }
    } else {
      const startHex = state.map[settlement.hexId];
      const targetHex = state.map[targetHexId];
      if (startHex && targetHex) {
        const path = Pathfinding.findPath(startHex.coordinate, targetHex.coordinate, state.map, config);
        if (path) {
          agent.path = path;
          agent.target = targetHex.coordinate;
          agent.activity = "MOVING";
          agent.status = "BUSY";
          agent.waitTicks = 0;
        } else {
          return null;
        }
      }
    }
    if (agent && agent.type === "Caravan") {
      agent.mission = mission;
      if (mission === "TRADE") {
        agent.homeId = settlement.id;
        agent.targetSettlementId = context.targetId;
        agent.tradeState = "OUTBOUND";
        agent.tradeResource = context.resource;
        agent.cargo.Gold = context.gold;
      } else if (mission === "LOGISTICS") {
        agent.homeId = settlement.id;
        agent.targetSettlementId = void 0;
        agent.tradeState = "OUTBOUND";
      }
    }
    return agent || null;
  },
  update(state, config, silent = false) {
    const agentsToRemove = [];
    Object.values(state.agents).forEach((agent) => {
      if (agent.type === "Caravan" && agent.status === "IDLE" && agent.homeId) {
        const home = state.settlements[agent.homeId];
        if (home && HexUtils.getID(agent.position) === home.hexId) {
          if (agent.integrity < 100) {
            const repairCost = config.costs.logistics?.caravanRepairCost || 5;
            if (home.stockpile.Timber >= repairCost) {
              home.stockpile.Timber -= repairCost;
              agent.integrity = Math.min(100, agent.integrity + 20);
            }
          }
        }
      }
      if (agent.waitTicks && agent.waitTicks > 0) {
        agent.waitTicks--;
        return;
      }
      if (agent.path && agent.path.length > 0) {
        return;
      }
      const hexId = HexUtils.getID(agent.position);
      const settlement = Object.values(state.settlements).find((s) => s.hexId === hexId);
      const loadingTime = config.costs.trade?.loadingTime || 20;
      if (agent.type === "Caravan" && agent.mission === "LOGISTICS") {
        if (agent.tradeState === "OUTBOUND") {
          if (agent.activity !== "LOADING") {
            agent.activity = "LOADING";
            agent.waitTicks = loadingTime;
            return;
          }
          const hex = state.map[hexId];
          if (hex && hex.resources) {
            Object.entries(hex.resources).forEach(([res, amount]) => {
              if (amount > 0) {
                agent.cargo[res] = (agent.cargo[res] || 0) + amount;
                hex.resources[res] = 0;
              }
            });
          }
          this.returnHome(state, agent, config);
        } else if (agent.tradeState === "INBOUND") {
          if (agent.activity !== "UNLOADING") {
            agent.activity = "UNLOADING";
            agent.waitTicks = loadingTime;
            return;
          }
          const homeId = agent.homeId;
          if (homeId) {
            const home = state.settlements[homeId];
            if (home) {
              const haul = [];
              Object.entries(agent.cargo).forEach(([res, amount]) => {
                if (amount > 0) {
                  home.stockpile[res] += amount;
                  haul.push(`${amount} ${res}`);
                  agent.cargo[res] = 0;
                }
              });
              if (!silent && haul.length > 0) {
                console.log(`[Logistics] Caravan returned to ${home.name} with: ${haul.join(", ")}`);
              }
            }
          }
          agent.status = "IDLE";
          agent.mission = "IDLE";
          agent.activity = "IDLE";
        }
        return;
      }
      if (agent.type === "Caravan" && agent.mission === "TRADE") {
        if (agent.tradeState === "OUTBOUND") {
          if (settlement && settlement.id === agent.targetSettlementId) {
            if (agent.activity !== "LOADING") {
              agent.activity = "LOADING";
              agent.waitTicks = loadingTime;
              return;
            }
            const neededRes = agent.tradeResource;
            const gold = agent.cargo.Gold || 0;
            const buyCap = config.costs.trade?.buyCap || 50;
            const amountToBuy = Math.min(gold, settlement.stockpile[neededRes], buyCap);
            if (amountToBuy > 0) {
              settlement.stockpile[neededRes] -= amountToBuy;
              settlement.stockpile.Gold += amountToBuy;
              agent.cargo.Gold = 0;
              agent.cargo[neededRes] = amountToBuy;
            }
            this.returnHome(state, agent, config);
          } else {
            this.returnHome(state, agent, config);
          }
        } else if (agent.tradeState === "INBOUND") {
          if (settlement && settlement.id === agent.homeId) {
            if (agent.activity !== "UNLOADING") {
              agent.activity = "UNLOADING";
              agent.waitTicks = loadingTime;
              return;
            }
            const haul = [];
            Object.entries(agent.cargo).forEach(([res, amount]) => {
              if (amount > 0) {
                settlement.stockpile[res] += amount;
                haul.push(`${amount} ${res}`);
                agent.cargo[res] = 0;
              }
            });
            if (!silent && haul.length > 0) {
              console.log(`[Trade] Caravan returned to ${settlement.name} with: ${haul.join(", ")}`);
            }
            agent.status = "IDLE";
            agent.mission = "IDLE";
            agent.activity = "IDLE";
          }
        }
      }
      if (agent.type === "Settler") {
        if (!agent.path || agent.path.length === 0) {
          const targetHex = state.map[HexUtils.getID(agent.position)];
          const existingSettlement = Object.values(state.settlements).find((s) => s.hexId === HexUtils.getID(agent.position));
          if (!existingSettlement && targetHex) {
            const newId = `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            state.settlements[newId] = {
              id: newId,
              name: `New Settlement ${Object.keys(state.settlements).length + 1}`,
              ownerId: agent.ownerId,
              hexId: HexUtils.getID(agent.position),
              population: config.ai.thresholds.newSettlementPop || 100,
              // Initial Pop
              tier: 0,
              integrity: config.ai.thresholds.newSettlementIntegrity || 100,
              // Initial Integrity
              stockpile: {
                Food: agent.cargo.Food || 0,
                Timber: agent.cargo.Timber || 0,
                Stone: agent.cargo.Stone || 0,
                Ore: agent.cargo.Ore || 0,
                Tools: agent.cargo.Tools || 0,
                Gold: agent.cargo.Gold || 0
              },
              // Unload Cargo
              buildings: [],
              // Grant Range 1 Territory immediately so Villagers have work
              controlledHexIds: [
                HexUtils.getID(agent.position),
                ...HexUtils.getNeighbors(agent.position).map((h) => HexUtils.getID(h))
              ].filter((id) => state.map[id]),
              // valid hexes only
              jobCap: 0,
              workingPop: 0,
              availableVillagers: 1,
              // Settler converts to Villager
              // Initialize with default values
              currentGoal: "SURVIVE",
              lastGrowth: 0,
              popHistory: []
            };
            if (state.map[HexUtils.getID(agent.position)]) {
              state.map[HexUtils.getID(agent.position)].ownerId = agent.ownerId;
            }
            if (!silent) console.log(`[GAME] Settlement Founded at ${HexUtils.getID(agent.position)}`);
          }
          agentsToRemove.push(agent.id);
        }
      }
    });
    agentsToRemove.forEach((id) => delete state.agents[id]);
  },
  returnHome(state, agent, config) {
    if (agent.type !== "Caravan" || !agent.homeId) return;
    const home = state.settlements[agent.homeId];
    if (home) {
      const homeHex = state.map[home.hexId];
      const path = Pathfinding.findPath(agent.position, homeHex.coordinate, state.map, config);
      if (path) {
        agent.path = path;
        agent.target = homeHex.coordinate;
        agent.tradeState = "INBOUND";
        agent.activity = "MOVING";
        agent.status = "RETURNING";
        agent.waitTicks = 0;
      }
    }
  }
};

// src/simulation/systems/IndustrySystem.ts
var IndustrySystem = {
  update(state, config) {
    Object.values(state.settlements).forEach((settlement) => {
      const TIMBER_COST = config.industry.costTimber;
      const ORE_COST = config.industry.costOre;
      const TARGET_TOOLS = Math.ceil(settlement.population * config.industry.targetToolRatio);
      const goal = settlement.currentGoal || "TOOLS";
      const SURPLUS_THRESHOLD = config.industry.surplusThreshold || 50;
      let canProduce = false;
      if (goal === "TOOLS") {
        canProduce = true;
      } else {
        if (settlement.stockpile.Timber > TIMBER_COST + SURPLUS_THRESHOLD && settlement.stockpile.Ore > ORE_COST + SURPLUS_THRESHOLD) {
          canProduce = true;
        }
      }
      if (canProduce && settlement.stockpile.Tools < TARGET_TOOLS) {
        if (settlement.stockpile.Timber >= TIMBER_COST && settlement.stockpile.Ore >= ORE_COST) {
          settlement.stockpile.Timber -= TIMBER_COST;
          settlement.stockpile.Ore -= ORE_COST;
          settlement.stockpile.Tools += 1;
        }
      }
    });
  }
};

// src/simulation/systems/MaintenanceSystem.ts
var MaintenanceSystem = {
  update(state, config) {
    Object.values(state.settlements).forEach((settlement) => {
      this.maintainSettlement(settlement, config);
      if (!settlement.buildings) settlement.buildings = [];
      settlement.buildings.forEach((building) => {
        const decay = config.maintenance ? config.maintenance.decayRate : 2;
        building.integrity = Math.max(0, building.integrity - decay);
        if (building.integrity < 100) {
          const buildConfig = config.buildings[building.type];
          if (buildConfig && buildConfig.cost) {
            this.attenptRepair(settlement, building, buildConfig.cost, config);
          }
        }
      });
    });
  },
  maintainSettlement(settlement, config) {
    const maintenanceCostPerPop = config.costs.maintenancePerPop || 0.05;
    const totalCost = settlement.population * maintenanceCostPerPop;
    const splitStone = config.maintenance?.resourceSplit.Stone || 0.3;
    const splitTimber = config.maintenance?.resourceSplit.Timber || 0.7;
    const stoneNeeded = totalCost * splitStone;
    const timberNeeded = totalCost * splitTimber;
    let repaired = 0;
    if (settlement.stockpile.Stone >= stoneNeeded) {
      settlement.stockpile.Stone -= stoneNeeded;
      repaired += splitStone;
    } else {
      const fraction = settlement.stockpile.Stone / Math.max(1, stoneNeeded);
      settlement.stockpile.Stone = 0;
      repaired += splitStone * fraction;
    }
    if (settlement.stockpile.Timber >= timberNeeded) {
      settlement.stockpile.Timber -= timberNeeded;
      repaired += splitTimber;
    } else {
      const fraction = settlement.stockpile.Timber / Math.max(1, timberNeeded);
      settlement.stockpile.Timber = 0;
      repaired += splitTimber * fraction;
    }
    if (repaired >= 0.99) {
      settlement.integrity = Math.min(100, settlement.integrity + 1);
    } else {
      const missing = 1 - repaired;
      const decayAmount = missing * 5;
      settlement.integrity = Math.max(0, settlement.integrity - decayAmount);
    }
  },
  attenptRepair(settlement, building, originalCost, config) {
    const REPAIR_AMOUNT = config.maintenance?.repairAmount || 10;
    const COST_FACTOR = config.maintenance?.repairCostFactor || 0.05;
    if (building.integrity >= 100) return;
    let canAfford = true;
    const repairCost = {};
    for (const [res, amount] of Object.entries(originalCost)) {
      const cost = Math.ceil(amount * COST_FACTOR);
      if (settlement.stockpile[res] < cost) {
        canAfford = false;
        break;
      }
      repairCost[res] = cost;
    }
    if (canAfford) {
      for (const [res, cost] of Object.entries(repairCost)) {
        settlement.stockpile[res] -= cost;
      }
      building.integrity = Math.min(100, building.integrity + REPAIR_AMOUNT);
    }
  }
};

// src/simulation/systems/UpgradeSystem.ts
var UpgradeSystem = {
  // Main Loop Update (Auto-Upgrade for Player for now)
  update(state, config, silent = false) {
    Object.values(state.settlements).forEach((settlement) => {
      if (settlement.ownerId === "player_1") {
        this.tryUpgrade(state, settlement, config, silent);
      }
    });
  },
  tryUpgrade(state, settlement, config, silent = false) {
    if (settlement.tier === 0) {
      if (this.canUpgradeToTown(state, settlement, config)) {
        this.performUpgradeToTown(state, settlement, config, silent);
        return true;
      }
    } else if (settlement.tier === 1) {
      if (this.canUpgradeToCity(state, settlement, config)) {
        this.performUpgradeToCity(state, settlement, config, silent);
        return true;
      }
    }
    return false;
  },
  canUpgradeToTown(state, settlement, config) {
    const upgradeConfig = config.upgrades.villageToTown;
    if (settlement.population < upgradeConfig.population) return false;
    if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
    if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;
    const centerHex = state.map[settlement.hexId];
    if (!centerHex) return false;
    const neighbors = HexUtils.getNeighbors(centerHex.coordinate);
    let plainsCount = centerHex.terrain === "Plains" ? 1 : 0;
    neighbors.forEach((n) => {
      if (state.map[HexUtils.getID(n)]?.terrain === "Plains") plainsCount++;
    });
    return plainsCount >= upgradeConfig.plainsCount;
  },
  performUpgradeToTown(state, settlement, config, silent = false) {
    const upgradeConfig = config.upgrades.villageToTown;
    settlement.stockpile.Timber -= upgradeConfig.costTimber;
    settlement.stockpile.Stone -= upgradeConfig.costStone;
    settlement.tier = 1;
    this.expandTerritory(state, settlement, 2);
    if (!silent) console.log(`[Gov] ${settlement.name} upgraded to Town!`);
  },
  canUpgradeToCity(state, settlement, config) {
    const upgradeConfig = config.upgrades.townToCity;
    if (settlement.population < upgradeConfig.population) return false;
    if (settlement.stockpile.Timber < upgradeConfig.costTimber) return false;
    if (settlement.stockpile.Stone < upgradeConfig.costStone) return false;
    if (settlement.stockpile.Ore < upgradeConfig.costOre) return false;
    const centerHex = state.map[settlement.hexId];
    if (!centerHex) return false;
    const neighbors = HexUtils.getNeighbors(centerHex.coordinate);
    let plainsCount = centerHex.terrain === "Plains" ? 1 : 0;
    neighbors.forEach((n) => {
      if (state.map[HexUtils.getID(n)]?.terrain === "Plains") plainsCount++;
    });
    return plainsCount >= upgradeConfig.plainsCount;
  },
  performUpgradeToCity(state, settlement, config, silent = false) {
    const upgradeConfig = config.upgrades.townToCity;
    settlement.stockpile.Timber -= upgradeConfig.costTimber;
    settlement.stockpile.Stone -= upgradeConfig.costStone;
    settlement.stockpile.Ore -= upgradeConfig.costOre;
    settlement.tier = 2;
    this.expandTerritory(state, settlement, 3);
    if (!silent) console.log(`[Gov] ${settlement.name} upgraded to City!`);
  },
  expandTerritory(state, settlement, range) {
    const centerHex = state.map[settlement.hexId];
    if (centerHex) {
      const expandedCoords = HexUtils.getSpiral(centerHex.coordinate, range);
      const newControlledIds = expandedCoords.map((c) => HexUtils.getID(c)).filter((id) => state.map[id]);
      settlement.controlledHexIds = newControlledIds;
    }
  }
};

// src/simulation/ai/GoalEvaluator.ts
var GoalEvaluator = class {
  static evaluate(state, settlement, config) {
    const consumption = settlement.population * config.costs.baseConsume;
    const surviveTicks = config.ai.thresholds.surviveTicks || 20;
    const criticalThreshold = Math.max(config.ai.thresholds.surviveFood, consumption * surviveTicks);
    const safeThreshold = criticalThreshold * 2;
    if (settlement.currentGoal === "SURVIVE") {
      if (settlement.stockpile.Food < safeThreshold) return "SURVIVE";
    } else {
      if (settlement.stockpile.Food < criticalThreshold) return "SURVIVE";
    }
    if (settlement.tier < 2) {
      let cap = config.upgrades.villageToTown.popCap || 200;
      if (settlement.tier === 1) cap = config.upgrades.townToCity.popCap || 500;
      const upgradePopRatio = config.ai.thresholds.upgradePopRatio || 0.8;
      if (settlement.population > cap * upgradePopRatio) return "UPGRADE";
      return "UPGRADE";
    }
    const existingSettlements = Object.values(state.settlements);
    const bestSpot = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, existingSettlements);
    if (bestSpot) {
      return "EXPAND";
    }
    return "TOOLS";
  }
};

// src/simulation/ai/ConstructionStrategy.ts
var ConstructionStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((settlement) => {
      const minBuffer = config.ai.thresholds.minConstructionBuffer || 50;
      if (settlement.stockpile.Stone < minBuffer || settlement.stockpile.Timber < minBuffer) return;
      const consumption = settlement.population * config.costs.baseConsume;
      const threshold = consumption * (config.ai?.utility?.surviveThreshold || 15);
      const foodHealth = settlement.stockpile.Food / (threshold || 1);
      const plains = settlement.controlledHexIds.filter((id) => state.map[id]?.terrain === "Plains");
      const huts = settlement.buildings.filter((b) => b.type === "GathererHut").length;
      const saturation = plains.length > 0 ? huts / plains.length : 1;
      let buildScore = 1 - foodHealth;
      if (settlement.currentGoal === "SURVIVE") buildScore += 0.2;
      buildScore *= 1 - saturation;
      if (buildScore > 0.1) {
        const target = plains.find((id) => !settlement.buildings?.some((b) => b.hexId === id));
        if (target) {
          actions.push({
            type: "BUILD",
            settlementId: settlement.id,
            buildingType: "GathererHut",
            hexId: target,
            score: buildScore
          });
        }
      }
    });
    return actions;
  }
};

// src/simulation/ai/LogisticsStrategy.ts
var LogisticsStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((settlement) => {
      const myCaravans = Object.values(state.agents).filter((a) => a.type === "Caravan" && a.ownerId === factionId && a.homeId === settlement.id);
      const targetFleet = config.ai?.utility?.fleetTargetSize || 3;
      const currentFleet = myCaravans.length;
      if (currentFleet < targetFleet && settlement.stockpile.Timber >= (config.costs.trade?.caravanTimberCost || 50)) {
        const fleetScore = (1 - currentFleet / targetFleet) * 0.5;
        if (fleetScore > 0.1) {
          actions.push({
            type: "BUILD_CARAVAN",
            settlementId: settlement.id,
            score: fleetScore
          });
        }
      }
      const threshold = config.costs.logistics?.freightThreshold || 40;
      settlement.controlledHexIds.forEach((hexId) => {
        if (hexId === settlement.hexId) return;
        const hex = state.map[hexId];
        if (hex && hex.resources) {
          const totalResources = Object.values(hex.resources).reduce((a, b) => a + b, 0);
          if (totalResources >= threshold) {
            const existing = Object.values(state.agents).find(
              (agent) => agent.type === "Caravan" && agent.ownerId === settlement.ownerId && agent.mission === "LOGISTICS" && agent.target && HexUtils.getID(agent.target) === hexId
            );
            if (!existing) {
              const score = Math.min(1, totalResources / 100);
              actions.push({
                type: "DISPATCH_CARAVAN",
                settlementId: settlement.id,
                targetHexId: hexId,
                mission: "LOGISTICS",
                context: {},
                score
              });
            }
          }
        }
      });
    });
    return actions;
  }
};

// src/simulation/ai/ExpansionStrategy.ts
var ExpansionStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let faction = state.factions[factionId];
    if (!faction) return [];
    const factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    const cost = config.costs.settlement;
    const buffer = config.ai ? config.ai.expansionBuffer : 1.5;
    const cap = config.ai ? config.ai.settlementCap : 5;
    if (factionSettlements.length >= cap) return [];
    let potentialSettlers = factionSettlements;
    if (settlementId) {
      potentialSettlers = potentialSettlers.filter((s) => s.id === settlementId);
    }
    potentialSettlers.forEach((settlement) => {
      if (settlement.stockpile.Food < (cost.Food || 0) * buffer || settlement.stockpile.Timber < (cost.Timber || 0) * buffer) {
        return;
      }
      const missing = [];
      if (settlement.stockpile.Stone < 50 && !settlement.controlledHexIds.some((h) => state.map[h].terrain === "Hills")) missing.push("Stone");
      if (settlement.stockpile.Ore < 50 && !settlement.controlledHexIds.some((h) => state.map[h].terrain === "Hills" || state.map[h].terrain === "Mountains")) missing.push("Ore");
      const saturationScore = Math.pow(settlement.population / settlement.jobCap, config.ai?.utility?.expandSaturationPower || 3);
      if (missing.length > 0) {
        const radius = config.ai?.utility?.expandSearchRadius || 10;
        const minDistance = config.ai?.utility?.expandMinDistance || 5;
        let bestCandidate = null;
        let bestDist = 999;
        const allSettlements = Object.values(state.settlements);
        Object.values(state.map).forEach((hex) => {
          if (hex.ownerId) return;
          const tooClose = allSettlements.some((s) => {
            const sHex = state.map[s.hexId];
            return sHex && HexUtils.distance(sHex.coordinate, hex.coordinate) < minDistance;
          });
          if (tooClose) return;
          let provides = false;
          if (missing.includes("Stone") && (hex.terrain === "Hills" || hex.terrain === "Mountains")) provides = true;
          if (missing.includes("Ore") && (hex.terrain === "Hills" || hex.terrain === "Mountains")) provides = true;
          if (provides) {
            const dist = HexUtils.distance(state.map[settlement.hexId].coordinate, hex.coordinate);
            if (dist <= radius && dist < bestDist) {
              bestCandidate = hex;
              bestDist = dist;
            }
          }
        });
        if (bestCandidate && bestCandidate.id) {
          const dist = bestDist || 1;
          const strategicScore = 1 / dist;
          const finalScore = Math.max(saturationScore, strategicScore);
          actions.push({
            type: "SPAWN_SETTLER",
            settlementId: settlement.id,
            targetHexId: bestCandidate.id,
            score: finalScore,
            context: { type: "Settler" }
          });
        } else if (saturationScore > 0.5) {
          const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
          if (target) {
            actions.push({
              type: "SPAWN_SETTLER",
              settlementId: settlement.id,
              targetHexId: target.id,
              score: saturationScore
            });
          }
        }
      } else if (saturationScore > 0.5) {
        const target = MapGenerator.findExpansionLocation(state.map, state.width, state.height, config, Object.values(state.settlements));
        if (target) {
          actions.push({
            type: "SPAWN_SETTLER",
            settlementId: settlement.id,
            targetHexId: target.id,
            score: saturationScore,
            context: { type: "Settler" }
          });
        }
      }
    });
    return actions;
  }
};

// src/simulation/ai/VillagerStrategy.ts
var VillagerStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((settlement) => {
      const currentAvailable = settlement.availableVillagers;
      if (currentAvailable <= 0) return;
      const surviveThreshold = settlement.population * config.costs.baseConsume * (config.ai?.utility?.surviveThreshold || 15);
      const foodRatio = settlement.stockpile.Food / (surviveThreshold || 1);
      let surviveScore = Math.max(0, 1 - foodRatio);
      if (foodRatio < 0.2) surviveScore *= 2;
      const range = config.costs.villagers?.range || 3;
      const jobs = [];
      const centerHex = state.map[settlement.hexId];
      settlement.controlledHexIds.forEach((hexId) => {
        const hex = state.map[hexId];
        if (!hex || !hex.resources) return;
        const dist = HexUtils.distance(centerHex.coordinate, hex.coordinate);
        if (dist > range) return;
        if (hex.resources.Food && hex.resources.Food > 0) {
          const baseScore = Math.min(1, hex.resources.Food / 100);
          jobs.push({ hexId, score: baseScore * surviveScore + 0.1, type: "SURVIVE" });
        }
        let provisionSum = 0;
        if (hex.resources.Timber) provisionSum += hex.resources.Timber * (settlement.aiState?.focusResources.includes("Timber") ? 2 : 1);
        if (hex.resources.Stone) provisionSum += hex.resources.Stone * (settlement.aiState?.focusResources.includes("Stone") ? 2 : 1);
        if (hex.resources.Ore) provisionSum += hex.resources.Ore * (settlement.aiState?.focusResources.includes("Ore") ? 2 : 1);
        if (provisionSum > 0) {
          const distMulti = config.ai?.utility?.provisionDistanceMulti || 10;
          const rawScore = provisionSum / (Math.max(1, dist) * distMulti);
          const provScore = Math.min(1, rawScore / 10);
          jobs.push({
            hexId,
            score: provScore,
            type: "PROVISION"
          });
        }
      });
      jobs.sort((a, b) => b.score - a.score);
      let localAvailable = currentAvailable;
      for (const job of jobs) {
        if (localAvailable <= 0) break;
        const assignedCount = Object.values(state.agents).filter(
          (a) => a.type === "Villager" && a.mission === "GATHER" && a.gatherTarget && HexUtils.getID(a.gatherTarget) === job.hexId
        ).length;
        const adjustedScore = job.score / (assignedCount + 1);
        if (adjustedScore > 0.1) {
          actions.push({
            type: "DISPATCH_VILLAGER",
            settlementId: settlement.id,
            targetHexId: job.hexId,
            score: adjustedScore
          });
          localAvailable--;
        }
      }
    });
    return actions;
  }
};

// src/simulation/ai/TradeStrategy.ts
var TradeStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((source) => {
      const goal = source.currentGoal || "TOOLS";
      const deficits = [];
      const surplus = [];
      const checkDeficit = (res, current, required, importance) => {
        if (current < required) {
          deficits.push({ res, score: (1 - current / required) * importance });
        }
      };
      if (goal === "UPGRADE") {
        const nextTier = source.tier + 1;
        const cost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
        const boost = source.aiState?.savingFor === "UPGRADE" ? 3 : 2;
        checkDeficit("Timber", source.stockpile.Timber, cost.costTimber, boost);
        checkDeficit("Stone", source.stockpile.Stone, cost.costStone, boost);
      } else if (goal === "EXPAND") {
        checkDeficit("Food", source.stockpile.Food, config.costs.settlement.Food || 500, 2);
        checkDeficit("Timber", source.stockpile.Timber, config.costs.settlement.Timber || 200, 2);
      } else if (goal === "SURVIVE") {
        const consumption = Math.max(5, source.population * config.costs.baseConsume);
        checkDeficit("Food", source.stockpile.Food, config.ai.thresholds.surviveFood || consumption * 50, 3);
      } else {
        const timberSurplus = source.stockpile.Timber > config.industry.surplusThreshold * 2;
        const oreSurplus = source.stockpile.Ore > config.industry.surplusThreshold * 2;
        if (timberSurplus && oreSurplus) {
          checkDeficit("Tools", source.stockpile.Tools, config.industry.surplusThreshold || 50, 2);
        }
      }
      if (source.aiState?.savingFor === "FLEET") {
        deficits.forEach((d) => d.score *= 0.5);
      }
      const lowGoldScore = source.stockpile.Gold < config.costs.trade.forceTradeGold ? 2 : 0.5;
      ["Timber", "Stone", "Ore", "Food"].forEach((r) => {
        const res = r;
        const threshold = config.industry.surplusThreshold || 100;
        let specificThreshold = threshold;
        if (res === "Food") specificThreshold = source.population * config.costs.baseConsume * config.ai.utility.surviveThreshold;
        if (source.stockpile[res] > specificThreshold) {
          const ratio = source.stockpile[res] / specificThreshold;
          surplus.push({
            res,
            amount: source.stockpile[res] - specificThreshold,
            score: Math.min(2, ratio - 1) * lowGoldScore
          });
        }
      });
      if (deficits.length === 0 && surplus.length === 0) return;
      const sourceHex = state.map[source.hexId];
      if (!sourceHex) return;
      if (deficits.length > 0) {
        deficits.sort((a, b) => b.score - a.score);
        const topDeficit = deficits[0];
        const neededRes = topDeficit.res;
        const potentialTargets = Object.values(state.settlements).filter((t) => t.id !== source.id);
        let bestPartner = null;
        for (const t of potentialTargets) {
          const tCons = Math.max(5, t.population * config.costs.baseConsume);
          const surplusThreshold = neededRes === "Food" ? tCons * config.costs.trade.neighborSurplusMulti : config.industry.surplusThreshold;
          if (t.stockpile[neededRes] > surplusThreshold) {
            const targetHex = state.map[t.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
            const distFactor = 1 + dist * 0.1;
            const adjustedScore = topDeficit.score / distFactor - travelCost * 1e-3;
            if (!bestPartner || adjustedScore > bestPartner.score) {
              bestPartner = { settlement: t, score: adjustedScore };
            }
          }
        }
        if (bestPartner) {
          const target = bestPartner.settlement;
          const existingRoute = Object.values(state.agents).find(
            (a) => a.type === "Caravan" && a.ownerId === source.ownerId && a.mission === "TRADE" && a.targetSettlementId === target.id && a.tradeResource === neededRes
          );
          if (!existingRoute) {
            const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
            const capacity = config.costs.trade.capacity || 50;
            const afford = Math.floor(source.stockpile.Gold / goldPerRes);
            const amount = Math.min(capacity, afford, target.stockpile[neededRes]);
            const tradeValue = amount * goldPerRes;
            const targetHex = state.map[target.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
            if (tradeValue > estimatedTravelCost && tradeValue >= config.costs.logistics.tradeRoiThreshold) {
              actions.push({
                type: "DISPATCH_CARAVAN",
                settlementId: source.id,
                targetHexId: target.hexId,
                mission: "TRADE",
                context: {
                  targetId: target.id,
                  resource: neededRes,
                  gold: amount * goldPerRes,
                  value: tradeValue
                },
                score: bestPartner.score
              });
            }
          }
        }
      }
      if (surplus.length > 0) {
        surplus.sort((a, b) => b.score - a.score);
        const topSurplus = surplus[0];
        const sellRes = topSurplus.res;
        const potentialBuyers = Object.values(state.settlements).filter((t) => t.id !== source.id);
        let bestBuyer = null;
        for (const t of potentialBuyers) {
          const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
          const minBuy = 5;
          if (t.stockpile.Gold >= minBuy * goldPerRes) {
            const targetHex = state.map[t.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const travelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
            const distFactor = 1 + dist * 0.1;
            const adjustedScore = topSurplus.score / distFactor - travelCost * 1e-3;
            if (!bestBuyer || adjustedScore > bestBuyer.score) {
              bestBuyer = { settlement: t, score: adjustedScore };
            }
          }
        }
        if (bestBuyer) {
          const target = bestBuyer.settlement;
          const existingRoute = Object.values(state.agents).find(
            (a) => a.type === "Caravan" && a.ownerId === source.ownerId && a.mission === "TRADE" && a.targetSettlementId === target.id && a.tradeResource === sellRes
          );
          if (!existingRoute) {
            const goldPerRes = config.costs.trade.simulatedGoldPerResource || 1;
            const capacity = config.costs.trade.capacity || 50;
            const amount = Math.min(capacity, topSurplus.amount, Math.floor(target.stockpile.Gold / goldPerRes));
            const tradeValue = amount * goldPerRes;
            const targetHex = state.map[target.hexId];
            const dist = HexUtils.distance(sourceHex.coordinate, targetHex.coordinate);
            const estimatedTravelCost = dist * 2 * (config.costs.trade.travelCostPerHex || 1);
            if (tradeValue > estimatedTravelCost && tradeValue >= config.costs.logistics.tradeRoiThreshold) {
              actions.push({
                type: "DISPATCH_CARAVAN",
                settlementId: source.id,
                targetHexId: target.hexId,
                mission: "TRADE",
                context: {
                  targetId: target.id,
                  resource: sellRes,
                  gold: 0,
                  value: tradeValue
                },
                score: bestBuyer.score
              });
            }
          }
        }
      }
    });
    return actions;
  }
};

// src/simulation/systems/ConstructionSystem.ts
var ConstructionSystem = {
  build(state, settlementId, buildingType, hexId, config, _silent = false) {
    const settlement = state.settlements[settlementId];
    if (!settlement) return false;
    const hex = state.map[hexId];
    if (!hex) return false;
    if (!settlement.controlledHexIds.includes(hexId)) return false;
    const existing = settlement.buildings.find((b) => b.hexId === hexId);
    if (existing) return false;
    const buildConfig = config.buildings[buildingType];
    if (!buildConfig) return false;
    if (settlement.tier < buildConfig.minTier) return false;
    const cost = buildConfig.cost;
    if (!this.canAfford(settlement.stockpile, cost)) return false;
    this.payCost(settlement.stockpile, cost);
    const newBuilding = {
      id: `bldg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: buildingType,
      hexId,
      integrity: 100,
      level: 1
    };
    if (!settlement.buildings) settlement.buildings = [];
    settlement.buildings.push(newBuilding);
    return true;
  },
  canAfford(stockpile, cost) {
    for (const [res, amount] of Object.entries(cost)) {
      if (stockpile[res] < amount) return false;
    }
    return true;
  },
  payCost(stockpile, cost) {
    for (const [res, amount] of Object.entries(cost)) {
      stockpile[res] -= amount;
    }
  }
};

// src/simulation/ai/RecruitStrategy.ts
var RecruitStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((settlement) => {
      const popRatio = config.costs.villagers?.popRatio || 10;
      const maxVillagers = Math.floor(Math.max(config.costs.villagers?.baseVillagers || 2, settlement.population / popRatio));
      const activeVillagers = Object.values(state.agents).filter((a) => a.type === "Villager" && a.homeId === settlement.id).length;
      const totalVillagers = settlement.availableVillagers + activeVillagers;
      if (totalVillagers < maxVillagers) {
        const surviveThreshold = settlement.population * config.costs.baseConsume * (config.ai?.utility?.surviveThreshold || 15);
        const safetyFactor = config.ai?.utility?.growthFoodSafety || 1;
        const recruitCost = config.costs.agents.Villager.Food || 100;
        const safeFood = surviveThreshold * safetyFactor;
        let foodMultiplier = 0;
        if (settlement.stockpile.Food > safeFood + recruitCost) {
          foodMultiplier = 1;
        } else if (settlement.stockpile.Food > recruitCost) {
          foodMultiplier = 0.5;
        }
        const fulfillment = totalVillagers / maxVillagers;
        const growScore = (1 - fulfillment) * foodMultiplier;
        if (growScore > 0) {
          actions.push({
            type: "RECRUIT_VILLAGER",
            settlementId: settlement.id,
            score: growScore
          });
        }
      }
    });
    return actions;
  }
};

// src/simulation/ai/UpgradeStrategy.ts
var UpgradeStrategy = class {
  evaluate(state, config, factionId, settlementId) {
    const actions = [];
    let factionSettlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    if (settlementId) {
      factionSettlements = factionSettlements.filter((s) => s.id === settlementId);
    }
    factionSettlements.forEach((settlement) => {
      if (settlement.tier >= 2) return;
      let reqMet = true;
      let cost;
      if (settlement.tier === 0) {
        cost = config.upgrades.villageToTown;
        if (settlement.population < cost.population) reqMet = false;
        if (settlement.stockpile.Timber < cost.costTimber) reqMet = false;
        if (settlement.stockpile.Stone < cost.costStone) reqMet = false;
      } else if (settlement.tier === 1) {
        cost = config.upgrades.townToCity;
        if (settlement.population < cost.population) reqMet = false;
        if (settlement.stockpile.Timber < cost.costTimber) reqMet = false;
        if (settlement.stockpile.Stone < cost.costStone) reqMet = false;
        if (settlement.stockpile.Ore < cost.costOre) reqMet = false;
      }
      if (reqMet) {
        const readinessPower = config.ai?.utility?.ascendReadinessPower || 2;
        const reqPop = cost.population;
        const score = Math.pow(settlement.population / reqPop, readinessPower);
        if (score > 0.5) {
          actions.push({
            type: "UPGRADE_SETTLEMENT",
            settlementId: settlement.id,
            score
          });
        }
      }
    });
    return actions;
  }
};

// src/simulation/ai/AIController.ts
var AIController = class {
  factionStates = /* @__PURE__ */ new Map();
  // Governors
  civilStrategies;
  // Spending & Construction
  hrStrategies;
  // Workforce & Logistics
  tradeStrategies;
  // Commerce
  constructor() {
    this.civilStrategies = [
      new ConstructionStrategy(),
      new ExpansionStrategy(),
      new UpgradeStrategy(),
      new LogisticsStrategy(),
      // For BUILD_CARAVAN
      new RecruitStrategy()
      // For RECRUIT_VILLAGER
    ];
    this.hrStrategies = [
      new VillagerStrategy(),
      // Dispatch
      new LogisticsStrategy()
      // Internal Trade/Transport
    ];
    this.tradeStrategies = [
      new TradeStrategy()
    ];
  }
  update(state, config, silent = false) {
    if (state.tick === 0 && !silent) console.log("AI UPDATING WITH SILENT=FALSE");
    const factionIds = Object.keys(state.factions);
    for (let i = factionIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [factionIds[i], factionIds[j]] = [factionIds[j], factionIds[i]];
    }
    factionIds.forEach((factionId) => {
      if (!this.factionStates.has(factionId)) {
        const stagger = Math.floor(Math.random() * 3);
        this.factionStates.set(factionId, {
          lastTick: state.tick - 100 + stagger,
          // Force immediate first run
          nextInterval: (config.ai ? config.ai.checkInterval : 10) + stagger
        });
      }
      const fState = this.factionStates.get(factionId);
      if (state.tick - fState.lastTick >= fState.nextInterval) {
        fState.lastTick = state.tick;
        const baseInterval = config.ai ? config.ai.checkInterval : 10;
        const jitter = Math.floor(Math.random() * 7) - 3;
        fState.nextInterval = Math.max(1, baseInterval + jitter);
        this.processFaction(factionId, state, config, silent);
      }
    });
  }
  processFaction(factionId, state, config, silent) {
    const settlements = Object.values(state.settlements).filter((s) => s.ownerId === factionId);
    settlements.forEach((s) => {
      s.currentGoal = GoalEvaluator.evaluate(state, s, config);
      this.updateInfluenceFlags(s, config);
    });
    settlements.forEach((s) => {
      this.runGovernor(s, state, config, "CIVIL", this.civilStrategies, silent);
      this.runGovernor(s, state, config, "LABOR", this.hrStrategies, silent);
      this.runGovernor(s, state, config, "TRANSPORT", this.hrStrategies, silent);
      this.runGovernor(s, state, config, "TRADE", this.tradeStrategies, silent);
    });
  }
  updateInfluenceFlags(settlement, config) {
    if (!settlement.aiState) {
      settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
    }
    const food = settlement.stockpile.Food;
    const consumption = Math.max(5, settlement.population * (config.costs.baseConsume || 0.1));
    const panicThreshold = consumption * 5;
    settlement.aiState.surviveMode = settlement.currentGoal === "SURVIVE" || food < panicThreshold;
    if (settlement.currentGoal === "UPGRADE") {
      settlement.aiState.savingFor = "UPGRADE";
      const nextTier = settlement.tier + 1;
      const upgradeCost = nextTier === 1 ? config.upgrades.villageToTown : config.upgrades.townToCity;
      const missing = [];
      if (settlement.stockpile.Timber < (upgradeCost.costTimber || 0)) missing.push("Timber");
      if (settlement.stockpile.Stone < (upgradeCost.costStone || 0)) missing.push("Stone");
      if (settlement.stockpile.Ore < (upgradeCost.costOre || 0)) missing.push("Ore");
      settlement.aiState.focusResources = missing;
    } else if (settlement.currentGoal === "EXPAND") {
      settlement.aiState.savingFor = null;
    } else {
      settlement.aiState.savingFor = null;
    }
  }
  runGovernor(settlement, state, config, governorType, strategies, silent = false) {
    const actions = [];
    strategies.forEach((strategy) => {
      actions.push(...strategy.evaluate(state, config, settlement.ownerId, settlement.id));
    });
    let relevantActions = actions.filter((a) => a.settlementId === settlement.id);
    if (settlement.aiState?.surviveMode) {
      if (governorType === "LABOR") {
      } else if (governorType === "CIVIL") {
        relevantActions = relevantActions.filter((a) => a.type === "BUILD" && a.buildingType === "GathererHut");
        if (relevantActions.length === 0) return;
      } else {
        return;
      }
    }
    switch (governorType) {
      case "CIVIL":
        relevantActions = relevantActions.filter(
          (a) => ["BUILD", "UPGRADE_SETTLEMENT", "SPAWN_SETTLER"].includes(a.type)
        );
        break;
      case "LABOR":
        relevantActions = relevantActions.filter(
          (a) => ["RECRUIT_VILLAGER", "DISPATCH_VILLAGER"].includes(a.type)
        );
        break;
      case "TRANSPORT":
        relevantActions = relevantActions.filter(
          (a) => ["BUILD_CARAVAN"].includes(a.type) || a.type === "DISPATCH_CARAVAN" && a.mission === "LOGISTICS"
        );
        break;
      case "TRADE":
        relevantActions = relevantActions.filter(
          (a) => a.type === "DISPATCH_CARAVAN" && a.mission === "TRADE"
        );
        break;
    }
    if (relevantActions.length === 0) return;
    relevantActions.forEach((a) => {
      a.score += Math.random() * 0.05;
    });
    relevantActions.sort((a, b) => b.score - a.score);
    if (!settlement.aiState) settlement.aiState = { surviveMode: false, savingFor: null, focusResources: [] };
    if (!settlement.aiState.lastDecisions) settlement.aiState.lastDecisions = {};
    settlement.aiState.lastDecisions[governorType] = relevantActions.slice(0, 3).map((a) => `${a.type}:${a.score.toFixed(2)}`);
    for (const action of relevantActions) {
      this.executeAction(state, config, action, silent);
    }
  }
  executeAction(state, config, action, silent = false) {
    switch (action.type) {
      case "BUILD_CARAVAN":
        const cSettlement = state.settlements[action.settlementId];
        const cCost = config.costs.trade?.caravanTimberCost || 50;
        if (cSettlement.stockpile.Timber >= cCost) {
          cSettlement.stockpile.Timber -= cCost;
          CaravanSystem.spawn(state, cSettlement.hexId, cSettlement.hexId, "Caravan", config);
          return true;
        }
        return false;
      case "BUILD":
        return ConstructionSystem.build(state, action.settlementId, action.buildingType, action.buildingType === "PavedRoad" || action.buildingType === "Masonry" ? action.hexId : action.hexId, config, silent);
      case "DISPATCH_CARAVAN":
        if (action.context?.type === "Settler") {
          return false;
        } else {
          const settlement2 = state.settlements[action.settlementId];
          CaravanSystem.dispatch(state, settlement2, action.targetHexId, action.mission, config, action.context);
          return true;
        }
      case "SPAWN_SETTLER":
        const settlement = state.settlements[action.settlementId];
        const agent = CaravanSystem.spawn(state, settlement.hexId, action.targetHexId, "Settler", config);
        if (agent) {
          agent.ownerId = settlement.ownerId;
          Object.entries(config.ai.expansionStarterPack).forEach(([res, amt]) => {
            agent.cargo[res] = amt;
          });
          settlement.stockpile.Food -= config.costs.settlement.Food || 0;
          settlement.stockpile.Timber -= config.costs.settlement.Timber || 0;
          settlement.population -= config.ai.settlerCost;
          if (!silent) console.log(`[AI] Spawned Settler from ${settlement.name}`);
          return true;
        }
        return false;
      case "RECRUIT_VILLAGER":
        const s = state.settlements[action.settlementId];
        const cost = config.costs.agents.Villager.Food || 100;
        if (s.stockpile.Food >= cost) {
          s.stockpile.Food -= cost;
          s.availableVillagers++;
          return true;
        }
        return false;
      case "DISPATCH_VILLAGER":
        const vSettlement = state.settlements[action.settlementId];
        if (vSettlement.availableVillagers > 0) {
          VillagerSystem.spawnVillager(state, action.settlementId, action.targetHexId, config);
          return true;
        }
        return false;
      case "UPGRADE_SETTLEMENT":
        const settlementToUpgrade = state.settlements[action.settlementId];
        return UpgradeSystem.tryUpgrade(state, settlementToUpgrade, config, silent);
    }
    return false;
  }
};

// src/simulation/GameLoop.ts
var GameLoop = class {
  state;
  config;
  aiController;
  silent = false;
  constructor(state, config, silent = false) {
    this.state = state;
    this.config = config;
    this.aiController = new AIController();
    this.silent = silent;
  }
  tick() {
    this.state.tick++;
    MovementSystem.update(this.state, this.config);
    CaravanSystem.update(this.state, this.config, this.silent);
    if (this.state.tick % this.config.simulation.resourceTickInterval === 0) {
      const prevResources = {};
      Object.values(this.state.settlements).forEach((s) => {
        prevResources[s.id] = { ...s.stockpile };
      });
      ExtractionSystem.update(this.state, this.config);
      VillagerSystem.update(this.state, this.config);
      IndustrySystem.update(this.state, this.config);
      MaintenanceSystem.update(this.state, this.config);
      MetabolismSystem.update(this.state, this.config, this.silent);
      UpgradeSystem.update(this.state, this.config, this.silent);
      CaravanSystem.processTrade(this.state, this.config);
      this.aiController.update(this.state, this.config, this.silent);
      Object.values(this.state.settlements).forEach((s) => {
        const prev = prevResources[s.id];
        if (prev) {
          s.resourceChange = {};
          Object.keys(s.stockpile).forEach((key) => {
            s.resourceChange[key] = s.stockpile[key] - prev[key];
          });
        }
      });
    }
    return this.state;
  }
  spawnAgent(startHexId, targetHexId) {
    return CaravanSystem.spawn(this.state, startHexId, targetHexId);
  }
  forceTrade() {
    CaravanSystem.forceTrade(this.state, this.config);
  }
  getState() {
    return this.state;
  }
};

// src/simulation/evolution/HeadlessRunner.ts
var HeadlessRunner = class {
  static run(config, options) {
    const state = createInitialState();
    const WIDTH = options.width;
    const HEIGHT = options.height;
    const map = MapGenerator.generate(WIDTH, HEIGHT);
    state.map = map;
    state.width = WIDTH;
    state.height = HEIGHT;
    const factions = ["player_1"];
    for (let i = 1; i < options.factionCount; i++) {
      factions.push(`rival_${i}`);
    }
    const usedHexes = [];
    factions.forEach((factionId, index) => {
      const isPlayer = factionId === "player_1";
      state.factions[factionId] = {
        id: factionId,
        name: isPlayer ? "Player" : `Rival ${index}`,
        color: isPlayer ? "#00ccff" : "#ff0000",
        gold: 100
      };
      const startingHex = MapGenerator.findStartingLocation(map, WIDTH, HEIGHT, config, usedHexes);
      if (startingHex) {
        usedHexes.push(startingHex.id);
        const neighbors = HexUtils.getSpiral(startingHex.coordinate, 5);
        neighbors.forEach((n) => usedHexes.push(HexUtils.getID(n)));
        const territory = HexUtils.getSpiral(startingHex.coordinate, 1);
        const controlledIds = territory.map((c) => HexUtils.getID(c)).filter((id2) => map[id2]);
        controlledIds.forEach((id2) => {
          if (map[id2]) map[id2].ownerId = factionId;
        });
        const id = `s_${factionId}_cap`;
        state.settlements[id] = {
          id,
          name: `${factionId} Capital`,
          hexId: startingHex.id,
          population: 100,
          ownerId: factionId,
          integrity: 100,
          tier: 0,
          jobCap: 100,
          workingPop: 100,
          availableVillagers: 2,
          controlledHexIds: controlledIds,
          buildings: [],
          popHistory: [],
          stockpile: { Food: 500, Timber: 50, Stone: 0, Ore: 0, Gold: 0, Tools: 0 }
        };
      }
    });
    const loop = new GameLoop(state, config, true);
    const stats = {
      survivalTicks: 0,
      idleTicks: 0,
      totalTicks: options.ticks,
      totalFactions: options.factionCount,
      popHistory: [],
      tiersReached: 0,
      enteredSurviveMode: false
    };
    const heartbeatInterval = Math.floor(options.ticks / 10);
    for (let i = 0; i < options.ticks; i++) {
      loop.tick();
      if (options.onHeartbeat && i > 0 && i % heartbeatInterval === 0) {
        const progress = Math.round(i / options.ticks * 100);
        options.onHeartbeat(progress);
      }
      let currentPop = 0;
      Object.values(state.settlements).forEach((s) => {
        currentPop += s.population;
        if (s.tier > stats.tiersReached) stats.tiersReached = s.tier;
        if (s.currentGoal === "SURVIVE") {
          stats.survivalTicks++;
          stats.enteredSurviveMode = true;
        }
      });
      if (i % 1e3 === 0) {
        stats.popHistory.push(currentPop);
      }
      Object.values(state.agents).forEach((a) => {
        if (a.status === "IDLE") stats.idleTicks++;
      });
      if (Object.keys(state.settlements).length === 0) {
        stats.totalTicks = i + 1;
        break;
      }
    }
    return { state, stats };
  }
};

// src/simulation/evolution/FitnessEvaluator.ts
var calculateFitness = (state, stats, generation = 0) => {
  let score = 0;
  const sortedPop = [...stats.popHistory].sort((a, b) => a - b);
  const medianPop = sortedPop.length > 0 ? sortedPop[Math.floor(sortedPop.length / 2)] : 0;
  score += medianPop;
  score += Math.floor(stats.totalTicks / 100);
  const tierMultiplier = Math.pow(1.5, stats.tiersReached);
  score *= tierMultiplier;
  if (!stats.enteredSurviveMode) {
    score *= 1.15;
  }
  Object.values(state.settlements).forEach((s) => {
    score += 100;
    if (s.tier === 1) score += 1e3;
    if (s.tier === 2) score += 2500;
    const stock = s.stockpile;
    const resources = [stock.Food, stock.Timber, stock.Stone, stock.Ore];
    const min = Math.min(...resources);
    const max = Math.max(...resources);
    const spread = max - min;
    if (spread <= 500) {
      score += 100;
    } else if (spread < 2e3) {
      const factor = 1 - (spread - 500) / 1500;
      score += 100 * factor;
    }
  });
  const totalGold = Object.values(state.factions).reduce((sum, f) => sum + (f.gold || 0), 0);
  score += totalGold * 1e-3;
  if (Object.keys(state.settlements).length === 0) {
    const deathPenalty = generation < 50 ? 500 : 5e3;
    score -= deathPenalty;
  }
  score -= stats.idleTicks * 0.05;
  return Math.max(0, score);
};

// src/simulation/evolution/Genome.ts
var genomeToConfig = (genome, baseConfig) => {
  const newConfig = JSON.parse(JSON.stringify(baseConfig));
  newConfig.ai.utility.surviveThreshold = genome.surviveThreshold;
  newConfig.ai.utility.growthFoodSafety = genome.growthFoodSafety;
  newConfig.ai.utility.provisionDistanceMulti = genome.provisionDistanceMulti;
  newConfig.ai.utility.ascendReadinessPower = genome.ascendReadinessPower;
  newConfig.ai.utility.buildRateLookback = genome.buildRateLookback;
  newConfig.ai.utility.commercialLowThreshold = genome.commercialLowThreshold;
  newConfig.ai.utility.commercialSurplusThreshold = genome.commercialSurplusThreshold;
  newConfig.ai.utility.fleetTargetSize = genome.fleetTargetSize;
  newConfig.ai.utility.expandSearchRadius = genome.expandSearchRadius;
  newConfig.ai.utility.expandSaturationPower = genome.expandSaturationPower;
  newConfig.ai.utility.expandMinDistance = genome.expandMinDistance;
  newConfig.ai.thresholds.recruitBuffer = genome.recruitBuffer;
  newConfig.ai.thresholds.villagerJobScoreMulti = genome.villagerJobScoreMulti;
  newConfig.ai.expansionBuffer = genome.expansionBuffer;
  newConfig.costs.logistics.tradeRoiThreshold = genome.tradeRoiThreshold;
  newConfig.costs.logistics.constructionRoiThreshold = genome.constructionRoiThreshold;
  newConfig.industry.targetToolRatio = genome.targetToolRatio;
  return newConfig;
};

// src/types/GameConfig.ts
var DEFAULT_CONFIG = {
  simulation: {
    tickRate: 100,
    resourceTickInterval: 10
  },
  costs: {
    movement: 1,
    // Base Movement Points per Tick
    terrain: {
      Plains: 1,
      Forest: 1.5,
      Hills: 2,
      Mountains: 3,
      Water: 1e3
    },
    baseConsume: 0.1,
    growthRate: 8e-3,
    maxLaborPerHex: 40,
    maintenancePerPop: 5e-3,
    yieldPerPop: 0.01,
    toolBonus: 1.5,
    toolBreakChance: 0.05,
    starvationRate: 5e-3,
    // Lowered from 0.02 to prevent death spiral
    growthSurplusBonus: 1e-4,
    // Multiplier for growth based on food surplus ratio
    settlement: {
      Food: 500,
      Timber: 200
    },
    trade: {
      caravanTimberCost: 50,
      simulatedGoldPerResource: 1,
      // Simple fixed price for now
      capacity: 50,
      spawnChance: 0.1,
      // 10% chance per tick to spawn a caravan if conditions met
      surplusThresholdMulti: 50,
      neighborSurplusMulti: 20,
      buyCap: 50,
      loadingTime: 20,
      forceTradeGold: 50,
      travelCostPerHex: 2
    },
    logistics: {
      caravanIntegrityLossPerHex: 0.5,
      caravanRepairCost: 2,
      // Timber
      freightThreshold: 40,
      // Min resources to dispatch
      tradeRoiThreshold: 20,
      constructionRoiThreshold: 50,
      // Min value to BUILD a new caravan
      freightConstructionThreshold: 100
      // Min resources to BUILD a new caravan
    },
    villagers: {
      cost: 100,
      // Food cost to buy a new villager
      speed: 0.5,
      // Slow down to 0.5 hex/tick (Takes 2 ticks to move 1 plains hex)
      capacity: 20,
      range: 3,
      popRatio: 50,
      baseVillagers: 2
    }
  },
  economy: {
    taxRate: 5e-3
  },
  industry: {
    targetToolRatio: 0.2,
    costTimber: 5,
    costOre: 2,
    surplusThreshold: 50
  },
  upgrades: {
    villageToTown: {
      popCap: 200,
      // Cap for Village (Tier 0)
      population: 100,
      // Req to Upgrade
      plainsCount: 1,
      costTimber: 300,
      costStone: 150
    },
    townToCity: {
      popCap: 500,
      // Cap for Town (Tier 1)
      population: 400,
      // Req to Upgrade
      plainsCount: 2,
      costTimber: 800,
      costStone: 400,
      costOre: 200
    },
    city: {
      popCap: 2e3
      // Cap for City (Tier 2)
    }
  },
  yields: {
    Plains: {
      Food: 4,
      Timber: 1
    },
    Forest: {
      Timber: 4,
      Food: 2
    },
    Hills: {
      Stone: 2,
      Ore: 1
    },
    Mountains: {
      Ore: 2,
      Stone: 1
    },
    Water: {
      Food: 3,
      Gold: 0.75
    }
  },
  ai: {
    settlementCap: 5,
    settlerCost: 50,
    expansionBuffer: 1.5,
    expansionStarterPack: {
      Food: 100,
      Timber: 50,
      Stone: 20,
      Ore: 0,
      Tools: 0,
      Gold: 0
    },
    checkInterval: 10,
    longCheckInterval: 50,
    thresholds: {
      surviveFood: 50,
      surviveTicks: 20,
      recruitBuffer: 2,
      // Multiplier of surviveFood for villager recruitment
      upgradeMinPop: 0.9,
      upgradePopRatio: 0.8,
      minConstructionBuffer: 50,
      militarySurplusTimber: 200,
      militarySurplusStone: 100,
      villagerJobScoreMulti: 10,
      newSettlementPop: 100,
      newSettlementIntegrity: 100
    },
    chances: {
      guardPostBuild: 0.05
    },
    weights: {
      base: 1,
      foodBonus: 1,
      goalPriority: 2,
      // Multiplier
      goalBonus: 5,
      // Flat
      stockpileLow: 5
    },
    utility: {
      surviveThreshold: 15,
      growthFoodSafety: 1,
      provisionDistanceMulti: 10,
      ascendReadinessPower: 2,
      buildRateLookback: 10,
      commercialLowThreshold: 0.5,
      // 50% of cap or goal
      commercialSurplusThreshold: 2,
      // 200% of need
      fleetTargetSize: 3,
      expandSearchRadius: 5,
      expandSaturationPower: 3,
      expandMinDistance: 5
    }
  },
  maintenance: {
    decayRate: 2,
    repairAmount: 10,
    repairCostFactor: 0.05,
    resourceSplit: {
      Stone: 0.3,
      Timber: 0.7
    }
  },
  buildings: {
    "GathererHut": {
      name: "Gatherer's Hut",
      cost: { Timber: 50 },
      minTier: 0,
      description: "+20% Yield on Hex",
      effects: [{ type: "YIELD_BONUS", value: 0.2 }]
    },
    "Warehouse": {
      name: "Warehouse",
      cost: { Timber: 100, Stone: 50 },
      minTier: 1,
      description: "Increases Storage Cap",
      effects: [{ type: "STORAGE", value: 1e3 }]
    },
    "Sawmill": {
      name: "Sawmill",
      cost: { Timber: 200 },
      minTier: 1,
      description: "Produces Planks (Future)"
    },
    "Masonry": {
      name: "Masonry",
      cost: { Stone: 200 },
      minTier: 1,
      description: "Produces Blocks (Future)"
    },
    "Smithy": {
      name: "Smithy",
      cost: { Stone: 150, Ore: 50 },
      minTier: 1,
      description: "Produces Tools"
    },
    "PavedRoad": {
      name: "Paved Road",
      cost: { Stone: 10 },
      minTier: 0,
      description: "+50% Movement Speed",
      effects: [{ type: "MOVEMENT", value: 0.5 }]
    },
    "GuardPost": {
      name: "Guard Post",
      cost: { Timber: 100, Stone: 20 },
      minTier: 0,
      description: "Spawns Patrol"
    },
    "Watchtower": {
      name: "Watchtower",
      cost: { Stone: 80 },
      minTier: 0,
      description: "Fog Clearance + Defense",
      effects: [{ type: "DEFENSE", value: 2 }]
    }
  }
};

// src/simulation/evolution/EvolutionWorker.ts
if (!parentPort) {
  throw new Error("EvolutionWorker must be run as a worker thread.");
}
parentPort.on("message", (message) => {
  try {
    Pathfinding.clearCache();
    const gameConfig = genomeToConfig(message.genome, message.config || DEFAULT_CONFIG);
    const runOptions = {
      ...message.options,
      onHeartbeat: void 0
    };
    const result = HeadlessRunner.run(gameConfig, runOptions);
    const fitness = calculateFitness(result.state, result.stats, message.generation);
    parentPort.postMessage({
      taskId: message.taskId,
      success: true,
      fitness,
      stats: result.stats,
      state: result.state
      // Transferring this might be the bottleneck.
    });
  } catch (error) {
    parentPort.postMessage({
      taskId: message.taskId,
      success: false,
      error
    });
  }
});
