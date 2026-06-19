/**
 * EXPERIENCE RECORDER
 * Smart logging system - only records important events
 * Filters out noise, keeps signal
 */

const learningSystem = require('./learningSystem');
const memory = require('./memory');

class ExperienceRecorder {
  constructor() {
    this.eventBuffer = [];
    this.lastMajorEvent = {};
  }

  /**
   * MINING EXPERIENCE
   * Record when bot mines ore
   */
  async recordMiningEvent(ore, location, yLevel, success = true) {
    if (!success) return; // Only log successful mining

    const event = {
      type: ore,
      ore: ore,
      location: { x: location.x, z: location.z },
      y: yLevel,
      timestamp: Date.now(),
      success: success
    };

    // Learn from it
    await learningSystem.recordAndLearn('mining', event);

    // Also record for memory
    memory.recordPlayerInteraction(
      memory.data.players['NEKO']?.username || 'NEKO',
      `Mined ${ore}`,
      `Collected ${ore} at Y:${yLevel}`
    );
  }

  /**
   * COMBAT EXPERIENCE
   * Record mob encounters
   */
  async recordCombatEvent(mob, outcome, damage = 0, location = null) {
    // Only log important combat events
    if (outcome === 'ignore') return; // Don't log minor skirmishes

    const event = {
      type: 'combat',
      mob: mob,
      defeated: outcome === 'victory',
      killedNeko: outcome === 'death',
      damage: damage,
      location: location,
      timestamp: Date.now()
    };

    if (outcome === 'death') {
      event.type = 'death';
      event.cause = mob;
    }

    await learningSystem.recordAndLearn('combat', event);
  }

  /**
   * DEATH EXPERIENCE
   * Record death (highest priority)
   */
  async recordDeath(cause, location) {
    const event = {
      type: 'death_location',
      cause: cause,
      location: { x: location.x, z: location.z },
      timestamp: Date.now()
    };

    // Reset days alive
    memory.data.daysAlive = 0;
    memory.saveMemory();

    await learningSystem.recordAndLearn('movement', event);
  }

  /**
   * MOVEMENT EXPERIENCE
   * Record important location discoveries
   */
  async recordLocationEvent(eventType, location, details = {}) {
    // Only log significant discoveries
    const importantTypes = ['found_new_area', 'found_cave', 'found_village'];
    if (!importantTypes.includes(eventType)) return;

    const event = {
      type: eventType,
      location: { x: location.x, z: location.z },
      biome: details.biome,
      resources: details.resources,
      mobs: details.mobs,
      timestamp: Date.now()
    };

    await learningSystem.recordAndLearn('movement', event);
  }

  /**
   * SAFE LOCATION RECORDING
   * Record places where bot survived
   */
  async recordSafeLocation(location) {
    const event = {
      type: 'safe_location',
      location: { x: location.x, z: location.z },
      timestamp: Date.now()
    };

    await learningSystem.recordAndLearn('movement', event);
  }

  /**
   * CHAT EXPERIENCE
   * Record player interactions
   */
  async recordChatEvent(player, message, sentiment = 'neutral') {
    // Only log meaningful interactions
    if (message.length < 3) return;

    const event = {
      type: 'chat',
      player: player,
      message: message,
      sentiment: sentiment,
      timestamp: Date.now()
    };

    // Detect if new player
    if (!memory.data.players[player]) {
      event.type = 'new_player';
      event.player = player;
      await learningSystem.recordAndLearn('chat', event);
    }

    // Always record for player memory
    memory.recordPlayerInteraction(player, message, '');
  }

  /**
   * BIOME DISCOVERY
   * Record biome characteristics
   */
  async recordBiomeEvent(biome, location, characteristics = {}) {
    const event = {
      type: 'biome_visit',
      biome: biome,
      location: { x: location.x, z: location.z },
      ore_found: characteristics.oreCount || 0,
      mob_encounters: characteristics.mobCount || 0,
      resources: characteristics.resources || [],
      timestamp: Date.now()
    };

    await learningSystem.recordAndLearn('movement', event);
  }

  /**
   * BASE LOCATION RECORDING
   * Record where bot built base
   */
  async recordBaseLocation(location) {
    memory.data.baseLocation = {
      x: location.x,
      z: location.z,
      built: Date.now()
    };
    memory.saveMemory();
  }

  /**
   * HEALTH STATUS CHANGE
   * Only log critical health events
   */
  async recordHealthEvent(health, maxHealth, event) {
    if (event !== 'critical' && event !== 'recovered') return;

    const eventData = {
      type: event,
      health: health,
      maxHealth: maxHealth,
      percentage: (health / maxHealth) * 100,
      timestamp: Date.now()
    };

    // Low priority - just log
    if (!memory.data.healthLog) memory.data.healthLog = [];
    memory.data.healthLog.push(eventData);
    if (memory.data.healthLog.length > 100) memory.data.healthLog.shift();
    memory.saveMemory();
  }

  /**
   * TOOL USAGE
   * Record which tools are used and effectiveness
   */
  async recordToolUsage(tool, target, effectiveness = 1) {
    if (!memory.data.toolStats) memory.data.toolStats = {};

    if (!memory.data.toolStats[tool]) {
      memory.data.toolStats[tool] = {
        uses: 0,
        totalEffectiveness: 0,
        averageEffectiveness: 0
      };
    }

    memory.data.toolStats[tool].uses++;
    memory.data.toolStats[tool].totalEffectiveness += effectiveness;
    memory.data.toolStats[tool].averageEffectiveness = 
      memory.data.toolStats[tool].totalEffectiveness / memory.data.toolStats[tool].uses;

    memory.saveMemory();
  }

  /**
   * RESOURCE COLLECTION
   * Track what resources were collected where
   */
  async recordResourceCollection(resource, amount, location) {
    if (!memory.data.resourceLog) memory.data.resourceLog = {};

    if (!memory.data.resourceLog[resource]) {
      memory.data.resourceLog[resource] = {
        totalCollected: 0,
        locations: [],
        averagePerSession: 0
      };
    }

    memory.data.resourceLog[resource].totalCollected += amount;
    memory.data.resourceLog[resource].locations.push({
      x: location.x,
      z: location.z,
      timestamp: Date.now()
    });

    memory.saveMemory();
  }

  /**
   * EXPLORATION MILESTONE
   * Record major exploration achievements
   */
  async recordExplorationMilestone(distance, biomes, structures) {
    const event = {
      type: 'exploration_milestone',
      distanceExplored: distance,
      biomesDiscovered: biomes,
      structuresFound: structures,
      timestamp: Date.now()
    };

    if (!memory.data.milestones) memory.data.milestones = [];
    memory.data.milestones.push(event);
    memory.saveMemory();

    await learningSystem.recordAndLearn('movement', event);
  }

  /**
   * GAME TIME MILESTONE
   * Record survival milestones
   */
  async recordSurvivalMilestone(daysAlive) {
    // Only log every 5 days
    if (daysAlive % 5 !== 0) return;

    const milestone = {
      daysAlive: daysAlive,
      timestamp: Date.now(),
      confidence: memory.data.confidenceLevel,
      baseUpgrades: memory.data.base.upgrades.length,
      itemsCollected: memory.data.base.resourcesCollected
    };

    if (!memory.data.survivalMilestones) memory.data.survivalMilestones = [];
    memory.data.survivalMilestones.push(milestone);
    memory.saveMemory();
  }

  /**
   * Get recording statistics
   */
  getStats() {
    const experiences = memory.data.experiences || {};
    return {
      totalEvents: Object.values(experiences).flat().length,
      categories: Object.keys(experiences),
      miningEvents: (experiences.mining || []).length,
      combatEvents: (experiences.combat || []).length,
      movementEvents: (experiences.movement || []).length,
      chatEvents: (experiences.chat || []).length,
      insights: (memory.data.insights || []).length
    };
  }
}

module.exports = new ExperienceRecorder();
