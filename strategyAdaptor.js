/**
 * STRATEGY ADAPTOR
 * Real-time behavior updater
 * Changes how NEKO mines, fights, and explores based on learned patterns
 */

const memory = require('./memory');
const learningSystem = require('./learningSystem');

class StrategyAdaptor {
  constructor() {
    this.currentStrategy = {};
    this.behaviorHistory = [];
  }

  /**
   * GET MINING STRATEGY
   * Decides where and what to mine based on learning
   */
  getMiningStrategy() {
    const strategy = memory.data.strategy?.mining || {};
    const patterns = learningSystem.patterns.mining || {};

    // If we've learned best Y-levels, prioritize them
    if (patterns.bestYLevels && patterns.bestYLevels.length > 0) {
      return {
        targetYLevel: patterns.bestYLevels[0].level,
        fallbackYLevel: patterns.bestYLevels[1]?.level || -60,
        priorityOres: ['diamond_ore', 'emerald_ore', 'gold_ore'],
        avoidOres: ['stone', 'dirt'],
        biomePreference: strategy.bestBiome || 'cave',
        efficiency: 'high'
      };
    }

    // Default strategy (learning mode)
    return {
      targetYLevel: -60,
      fallbackYLevel: -50,
      priorityOres: ['diamond_ore', 'emerald_ore', 'gold_ore', 'iron_ore'],
      avoidOres: ['stone'],
      biomePreference: 'cave',
      efficiency: 'learning'
    };
  }

  /**
   * GET COMBAT STRATEGY
   * Decides when to fight vs flee based on experience
   */
  getCombatStrategy() {
    const strategy = memory.data.strategy?.combat || {};
    const patterns = learningSystem.patterns.combat || {};
    const confidence = memory.data.confidenceLevel || 1;

    // If we know which mobs are dangerous, avoid them
    const mobsToAvoid = strategy.avoidMobs || [];
    const successRate = patterns.successRate || 0;

    return {
      preferredTactic: confidence > 50 ? 'fight' : 'flee',
      dangerousMobs: mobsToAvoid,
      fightConfidenceThreshold: Math.max(30, 50 - successRate), // Adapt based on success
      fleeWhenHealthBelow: confidence < 40 ? 10 : 5,
      safeDistance: 30,
      aggressiveness: Math.min(10, Math.floor(confidence / 10))
    };
  }

  /**
   * GET MOVEMENT STRATEGY
   * Decides where to explore and avoid based on safety
   */
  getMovementStrategy() {
    const strategy = memory.data.strategy?.movement || {};
    const dangerZones = strategy.dangerZones || {};
    const safeZones = strategy.safeLocations || {};
    const baseLocation = memory.data.baseLocation;

    // Build danger zone coordinates
    const dangerCoordinates = Object.values(dangerZones).map(z => ({
      x: z.x,
      z: z.z,
      cause: z.cause
    }));

    return {
      homeBase: baseLocation || { x: 0, z: 0 },
      safeZones: Object.values(safeZones).slice(0, 10), // Remember top 10 safe spots
      dangerZones: dangerCoordinates.slice(0, 10),
      preferredBiome: strategy.preferredBiome || 'cave',
      explorationRadius: 500,
      returnHomeWhenHealthLow: true
    };
  }

  /**
   * GET CHAT STRATEGY
   * How to interact with players based on memory
   */
  getChatStrategy() {
    const strategy = memory.data.strategy?.chat || {};
    const knownPlayers = strategy.knownPlayers || {};

    // Personalize responses based on player history
    const playerCustomization = {};
    Object.entries(knownPlayers).forEach(([player, profile]) => {
      playerCustomization[player] = {
        isFriendly: true, // Default
        commonTopics: profile.topics || {},
        interactionCount: profile.messages || 0,
        preferredTone: profile.messages > 10 ? 'casual' : 'formal'
      };
    });

    return {
      knownPlayers: playerCustomization,
      rememberNames: true,
      buildRelationships: true,
      learnPreferences: true,
      adaptTone: true
    };
  }

  /**
   * ADAPT BEHAVIOR - Called periodically to update all strategies
   */
  async adaptBehavior() {
    try {
      // Update all strategies based on current patterns
      const newStrategy = {
        mining: this.getMiningStrategy(),
        combat: this.getCombatStrategy(),
        movement: this.getMovementStrategy(),
        chat: this.getChatStrategy(),
        lastAdapted: Date.now()
      };

      this.currentStrategy = newStrategy;

      // Log behavior change if significant
      this.recordBehaviorChange(newStrategy);

      return newStrategy;
    } catch (error) {
      console.log('[Strategy Adaptor] Error:', error.message);
      return this.currentStrategy;
    }
  }

  /**
   * RECOMMEND ACTION
   * Based on current situation and learned strategies
   */
  recommendAction(situation) {
    const { type, data } = situation;

    switch (type) {
      case 'mining':
        return this.recommendMiningAction(data);
      case 'combat':
        return this.recommendCombatAction(data);
      case 'movement':
        return this.recommendMovementAction(data);
      case 'chat':
        return this.recommendChatAction(data);
      default:
        return { action: 'idle' };
    }
  }

  /**
   * Recommend mining action
   */
  recommendMiningAction(data) {
    const strategy = this.getMiningStrategy();
    const { currentOre, currentYLevel, nearbyOres } = data;

    // If current ore is in priority list, continue
    if (strategy.priorityOres.includes(currentOre)) {
      return { action: 'continue_mining', reason: 'priority_ore' };
    }

    // If nearby ore is better, move to it
    const betterOre = nearbyOres?.find(ore => 
      strategy.priorityOres.indexOf(ore) < strategy.priorityOres.indexOf(currentOre)
    );

    if (betterOre) {
      return { action: 'move_to_ore', targetOre: betterOre, reason: 'higher_priority' };
    }

    // If at target Y-level, continue
    if (Math.abs(currentYLevel - strategy.targetYLevel) < 5) {
      return { action: 'continue_mining', reason: 'optimal_ylevel' };
    }

    // Move to better Y-level
    return { action: 'change_ylevel', targetYLevel: strategy.targetYLevel };
  }

  /**
   * Recommend combat action
   */
  recommendCombatAction(data) {
    const strategy = this.getCombatStrategy();
    const { mob, distance, health } = data;

    // If dangerous mob, flee
    if (strategy.dangerousMobs.includes(mob)) {
      return { action: 'flee', reason: 'dangerous_mob', urgency: 'high' };
    }

    // If health critical, always flee
    if (health < strategy.fleeWhenHealthBelow) {
      return { action: 'flee', reason: 'low_health', urgency: 'critical' };
    }

    // Use learned combat tactic
    if (strategy.preferredTactic === 'fight') {
      return { action: 'fight', reason: 'confident', urgency: 'normal' };
    } else {
      return { action: 'flee', reason: 'not_confident', urgency: 'high' };
    }
  }

  /**
   * Recommend movement action
   */
  recommendMovementAction(data) {
    const strategy = this.getMovementStrategy();
    const { currentLocation, nearbyLocations } = data;

    // Check if we're in a danger zone
    const inDangerZone = strategy.dangerZones.some(zone =>
      Math.hypot(zone.x - currentLocation.x, zone.z - currentLocation.z) < 50
    );

    if (inDangerZone) {
      return { action: 'move_to_safety', reason: 'in_danger_zone', urgency: 'high' };
    }

    // Check if in safe zone - continue exploring
    const inSafeZone = strategy.safeZones.some(zone =>
      Math.hypot(zone.x - currentLocation.x, zone.z - currentLocation.z) < 100
    );

    if (inSafeZone) {
      return { action: 'explore', reason: 'in_safe_zone', radius: strategy.explorationRadius };
    }

    // Explore in preferred biome direction
    return { action: 'explore', reason: 'search_for_resources', preferredBiome: strategy.preferredBiome };
  }

  /**
   * Recommend chat action
   */
  recommendChatAction(data) {
    const strategy = this.getChatStrategy();
    const { player, message } = data;

    const playerInfo = strategy.knownPlayers[player];

    if (playerInfo) {
      return {
        action: 'respond_personalized',
        tone: playerInfo.preferredTone,
        topics: playerInfo.commonTopics,
        interaction: playerInfo.interactionCount
      };
    } else {
      return {
        action: 'respond_friendly',
        tone: 'formal',
        reason: 'new_player'
      };
    }
  }

  /**
   * Record behavior changes (for tracking adaptation)
   */
  recordBehaviorChange(newStrategy) {
    const change = {
      timestamp: Date.now(),
      strategy: newStrategy,
      daysAlive: memory.data.daysAlive,
      confidence: memory.data.confidenceLevel
    };

    this.behaviorHistory.push(change);

    // Keep last 100 behavior changes
    if (this.behaviorHistory.length > 100) {
      this.behaviorHistory.shift();
    }
  }

  /**
   * GET ADAPTATION REPORT
   * Shows how much the bot has adapted
   */
  getAdaptationReport() {
    const currentMining = this.getMiningStrategy();
    const currentCombat = this.getCombatStrategy();
    const currentMovement = this.getMovementStrategy();

    return {
      hasMiningStrategy: currentMining.efficiency === 'high',
      knownDangerousMobs: currentCombat.dangerousMobs.length,
      knownSafeZones: currentMovement.safeZones.length,
      knownDangerZones: currentMovement.dangerZones.length,
      playerRelationships: Object.keys(currentMovement.safeZones).length,
      adaptationLevel: Math.min(10, Math.floor(
        (currentMining.efficiency === 'high' ? 3 : 1) +
        (currentCombat.dangerousMobs.length / 5) +
        (currentMovement.knownPlayers / 5) +
        (memory.data.daysAlive / 10)
      )),
      lastAdapted: this.currentStrategy.lastAdapted
    };
  }
}

module.exports = new StrategyAdaptor();
