/**
 * NEKO LEARNING SYSTEM
 * Core AI engine that analyzes experiences and adapts behavior
 * Real-time pattern recognition and strategy updates
 */

const memory = require('./memory');

class LearningSystem {
  constructor() {
    this.patterns = {};
    this.strategies = {};
    this.insights = [];
    this.lastAnalysis = Date.now();
  }

  /**
   * MAIN LEARNING FUNCTION
   * Called whenever something important happens
   * Analyzes patterns in real-time
   */
  async recordAndLearn(category, event) {
    try {
      // 1. Record the experience
      this.recordExperience(category, event);

      // 2. Analyze patterns immediately (real-time)
      this.analyzePatterns(category);

      // 3. Generate insights
      const insight = this.generateInsight(category, event);
      if (insight) {
        this.insights.push(insight);
        memory.data.insights = (memory.data.insights || []).slice(-100); // Keep last 100
        memory.data.insights.push(insight);
        memory.saveMemory();
      }

      // 4. Update strategy in real-time
      await this.updateStrategy(category);

      return { success: true, insight };
    } catch (error) {
      console.log('[Learning] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record an experience (smart logging)
   * Only logs important/exceptional events
   */
  recordExperience(category, event) {
    if (!memory.data.experiences) {
      memory.data.experiences = {};
    }

    if (!memory.data.experiences[category]) {
      memory.data.experiences[category] = [];
    }

    // Add timestamp and calculate importance
    const experience = {
      ...event,
      timestamp: Date.now(),
      importance: this.calculateImportance(category, event)
    };

    memory.data.experiences[category].push(experience);

    // Keep last 500 experiences per category (no limit but smart cleanup)
    if (memory.data.experiences[category].length > 500) {
      // Keep high-importance ones, remove low-importance old ones
      const sorted = memory.data.experiences[category]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0));
      memory.data.experiences[category] = sorted.slice(0, 500);
    }

    memory.saveMemory();
  }

  /**
   * Calculate how important an event is (1-10)
   * Higher = more important to remember
   */
  calculateImportance(category, event) {
    const importanceMap = {
      mining: {
        diamond_ore: 10,
        emerald_ore: 10,
        gold_ore: 7,
        iron_ore: 5,
        stone: 1
      },
      combat: {
        death: 10,
        defeated_strong_mob: 8,
        defeated_mob: 5,
        took_damage: 3
      },
      movement: {
        found_new_area: 8,
        death_location: 10,
        safe_location: 6,
        dangerous_area: 9
      },
      chat: {
        new_player: 7,
        repeated_question: 5,
        player_compliment: 8,
        important_info: 9
      }
    };

    return (importanceMap[category]?.[event.type] || 5);
  }

  /**
   * PATTERN ANALYSIS
   * Find patterns in experiences (real-time)
   * "Diamonds found more at Y:-60"
   * "Creepers kill faster than zombies"
   */
  analyzePatterns(category) {
    if (!memory.data.experiences?.[category]) return;

    const experiences = memory.data.experiences[category];
    const patterns = {};

    switch (category) {
      case 'mining':
        patterns.oreDistribution = this.analyzeMiningPatterns(experiences);
        patterns.bestYLevels = this.findBestYLevels(experiences);
        patterns.oreValue = this.calculateOreValue(experiences);
        break;

      case 'combat':
        patterns.mobDangerLevels = this.analyzeMobDanger(experiences);
        patterns.successRate = this.calculateCombatSuccess(experiences);
        patterns.deathCauses = this.analyzeDeaths(experiences);
        break;

      case 'movement':
        patterns.safeLocations = this.findSafeLocations(experiences);
        patterns.dangerZones = this.findDangerZones(experiences);
        patterns.bestBiomes = this.analyzeBiomes(experiences);
        break;

      case 'chat':
        patterns.playerProfiles = this.buildPlayerProfiles(experiences);
        patterns.commonQuestions = this.findCommonQuestions(experiences);
        break;
    }

    this.patterns[category] = patterns;
    memory.data.patterns = (memory.data.patterns || {});
    memory.data.patterns[category] = patterns;
    memory.saveMemory();
  }

  /**
   * Mining pattern analysis
   */
  analyzeMiningPatterns(experiences) {
    const distribution = {};
    experiences.forEach(exp => {
      if (exp.ore) {
        distribution[exp.ore] = (distribution[exp.ore] || 0) + 1;
      }
    });
    return distribution;
  }

  /**
   * Find Y-levels with most diamonds
   */
  findBestYLevels(experiences) {
    const yLevelStats = {};
    experiences.forEach(exp => {
      if (exp.ore === 'diamond_ore' && exp.y) {
        const level = Math.floor(exp.y / 10) * 10; // Round to nearest 10
        yLevelStats[level] = (yLevelStats[level] || 0) + 1;
      }
    });

    // Return top 3 Y-levels
    return Object.entries(yLevelStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([level, count]) => ({ level: parseInt(level), frequency: count }));
  }

  /**
   * Calculate ore value (diamonds > gold > iron > stone)
   */
  calculateOreValue(experiences) {
    const values = {};
    const prices = {
      diamond_ore: 100,
      emerald_ore: 90,
      gold_ore: 50,
      iron_ore: 20,
      stone: 1
    };

    experiences.forEach(exp => {
      if (exp.ore) {
        values[exp.ore] = {
          count: (values[exp.ore]?.count || 0) + 1,
          value: prices[exp.ore] || 1,
          totalValue: ((values[exp.ore]?.totalValue || 0) + (prices[exp.ore] || 1))
        };
      }
    });

    return values;
  }

  /**
   * Combat analysis - which mobs are dangerous
   */
  analyzeMobDanger(experiences) {
    const mobStats = {};
    experiences.forEach(exp => {
      if (exp.mob) {
        if (!mobStats[exp.mob]) {
          mobStats[exp.mob] = {
            encounters: 0,
            damageDealt: 0,
            defeats: 0,
            deaths: 0
          };
        }
        mobStats[exp.mob].encounters++;
        mobStats[exp.mob].damageDealt += exp.damage || 0;
        if (exp.defeated) mobStats[exp.mob].defeats++;
        if (exp.killedNeko) mobStats[exp.mob].deaths++;
      }
    });

    // Calculate danger level (0-10)
    Object.keys(mobStats).forEach(mob => {
      const stats = mobStats[mob];
      const winRate = stats.defeats / stats.encounters;
      const damagePerEncounter = stats.damageDealt / stats.encounters;
      stats.dangerLevel = Math.round((1 - winRate) * 5 + (damagePerEncounter / 10) * 5);
      stats.dangerLevel = Math.min(10, Math.max(0, stats.dangerLevel));
    });

    return mobStats;
  }

  /**
   * Calculate combat success rate
   */
  calculateCombatSuccess(experiences) {
    let totalFights = 0;
    let successfulFights = 0;

    experiences.forEach(exp => {
      if (exp.type === 'combat') {
        totalFights++;
        if (exp.defeated) successfulFights++;
      }
    });

    return totalFights > 0 ? (successfulFights / totalFights) * 100 : 0;
  }

  /**
   * Analyze death causes
   */
  analyzeDeaths(experiences) {
    const causes = {};
    experiences.forEach(exp => {
      if (exp.type === 'death') {
        causes[exp.cause] = (causes[exp.cause] || 0) + 1;
      }
    });
    return causes;
  }

  /**
   * Find safe locations (where bot didn't die)
   */
  findSafeLocations(experiences) {
    const locations = {};
    experiences.forEach(exp => {
      if (exp.type === 'safe_location' && exp.location) {
        const key = `${Math.floor(exp.location.x / 100)},${Math.floor(exp.location.z / 100)}`;
        locations[key] = {
          x: exp.location.x,
          z: exp.location.z,
          visits: (locations[key]?.visits || 0) + 1
        };
      }
    });
    return locations;
  }

  /**
   * Find danger zones (where bot died)
   */
  findDangerZones(experiences) {
    const zones = {};
    experiences.forEach(exp => {
      if (exp.type === 'death_location' && exp.location) {
        const key = `${Math.floor(exp.location.x / 100)},${Math.floor(exp.location.z / 100)}`;
        zones[key] = {
          x: exp.location.x,
          z: exp.location.z,
          deaths: (zones[key]?.deaths || 0) + 1,
          cause: exp.cause
        };
      }
    });
    return zones;
  }

  /**
   * Analyze biomes
   */
  analyzeBiomes(experiences) {
    const biomes = {};
    experiences.forEach(exp => {
      if (exp.biome) {
        biomes[exp.biome] = {
          visits: (biomes[exp.biome]?.visits || 0) + 1,
          ore_found: (biomes[exp.biome]?.ore_found || 0) + (exp.ore_found ? 1 : 0),
          mobs: (biomes[exp.biome]?.mobs || 0) + (exp.mob_encounters || 0)
        };
      }
    });
    return biomes;
  }

  /**
   * Build player profiles from chat interactions
   */
  buildPlayerProfiles(experiences) {
    const profiles = {};
    experiences.forEach(exp => {
      if (exp.player) {
        if (!profiles[exp.player]) {
          profiles[exp.player] = {
            messages: 0,
            topics: {},
            sentiment: 'neutral',
            lastSeen: Date.now()
          };
        }
        profiles[exp.player].messages++;
        profiles[exp.player].lastSeen = exp.timestamp;

        if (exp.topic) {
          profiles[exp.player].topics[exp.topic] = 
            (profiles[exp.player].topics[exp.topic] || 0) + 1;
        }
      }
    });
    return profiles;
  }

  /**
   * Find common questions asked
   */
  findCommonQuestions(experiences) {
    const questions = {};
    experiences.forEach(exp => {
      if (exp.question) {
        questions[exp.question] = (questions[exp.question] || 0) + 1;
      }
    });
    return questions;
  }

  /**
   * Generate insight when something interesting happens
   */
  generateInsight(category, event) {
    const insights = {
      mining: () => {
        if (event.ore === 'diamond_ore') {
          return `Found diamonds at Y:${event.y}! Diamonds are rare - prioritize!`;
        }
        if (event.ore === 'gold_ore') {
          return `Gold ore discovered! Worth more than iron.`;
        }
      },
      combat: () => {
        if (event.type === 'death') {
          return `DEATH by ${event.cause}! Avoid ${event.cause} in future!`;
        }
        if (event.defeated && event.mob) {
          return `Successfully defeated ${event.mob}! Getting better at combat!`;
        }
      },
      movement: () => {
        if (event.type === 'found_new_area') {
          return `Discovered new area! Exploring is productive!`;
        }
        if (event.type === 'death_location') {
          return `Died at ${event.location.x}, ${event.location.z}. Mark as danger zone!`;
        }
      },
      chat: () => {
        if (event.type === 'new_player') {
          return `New player ${event.player}! Add to my memory!`;
        }
      }
    };

    const generator = insights[category];
    return generator ? generator() : null;
  }

  /**
   * UPDATE STRATEGY IN REAL-TIME
   * Changes how NEKO behaves based on what she learned
   */
  async updateStrategy(category) {
    const patterns = this.patterns[category];
    if (!patterns) return;

    switch (category) {
      case 'mining':
        await this.updateMiningStrategy(patterns);
        break;
      case 'combat':
        await this.updateCombatStrategy(patterns);
        break;
      case 'movement':
        await this.updateMovementStrategy(patterns);
        break;
      case 'chat':
        await this.updateChatStrategy(patterns);
        break;
    }
  }

  async updateMiningStrategy(patterns) {
    if (!patterns.bestYLevels || patterns.bestYLevels.length === 0) return;

    // Update mining priority
    memory.data.strategy = memory.data.strategy || {};
    memory.data.strategy.mining = {
      targetYLevel: patterns.bestYLevels[0].level,
      priorityOres: ['diamond_ore', 'emerald_ore', 'gold_ore'],
      bestBiome: 'cave',
      lastUpdated: Date.now()
    };

    memory.saveMemory();
  }

  async updateCombatStrategy(patterns) {
    if (!patterns.mobDangerLevels) return;

    // Update combat avoidance
    const dangerousMobs = Object.entries(patterns.mobDangerLevels)
      .filter(([_, stats]) => stats.dangerLevel > 7)
      .map(([mob]) => mob);

    memory.data.strategy = memory.data.strategy || {};
    memory.data.strategy.combat = {
      avoidMobs: dangerousMobs,
      successRate: patterns.successRate,
      preferredTactic: patterns.successRate > 60 ? 'fight' : 'flee',
      lastUpdated: Date.now()
    };

    memory.saveMemory();
  }

  async updateMovementStrategy(patterns) {
    memory.data.strategy = memory.data.strategy || {};
    memory.data.strategy.movement = {
      safeZones: patterns.safeLocations,
      dangerZones: patterns.dangerZones,
      preferredBiome: patterns.bestBiomes ? 
        Object.entries(patterns.bestBiomes)
          .sort((a, b) => b[1].ore_found - a[1].ore_found)[0][0] : null,
      lastUpdated: Date.now()
    };

    memory.saveMemory();
  }

  async updateChatStrategy(patterns) {
    memory.data.strategy = memory.data.strategy || {};
    memory.data.strategy.chat = {
      knownPlayers: patterns.playerProfiles,
      commonTopics: patterns.commonQuestions,
      lastUpdated: Date.now()
    };

    memory.saveMemory();
  }

  /**
   * Get all learned knowledge
   */
  getKnowledge() {
    return {
      patterns: this.patterns,
      strategies: memory.data.strategy || {},
      experiences: Object.keys(memory.data.experiences || {}).map(cat => ({
        category: cat,
        count: (memory.data.experiences[cat] || []).length
      })),
      insights: memory.data.insights || []
    };
  }

  /**
   * Recall specific knowledge
   */
  recall(query) {
    const lowerQuery = query.toLowerCase();

    // Search insights
    const matchingInsights = (memory.data.insights || [])
      .filter(i => i.toLowerCase().includes(lowerQuery));

    // Search patterns
    const matchingPatterns = {};
    Object.entries(this.patterns).forEach(([cat, patterns]) => {
      Object.entries(patterns).forEach(([key, value]) => {
        if (key.toLowerCase().includes(lowerQuery)) {
          matchingPatterns[`${cat}.${key}`] = value;
        }
      });
    });

    return {
      insights: matchingInsights,
      patterns: matchingPatterns,
      foundCount: matchingInsights.length + Object.keys(matchingPatterns).length
    };
  }
}

module.exports = new LearningSystem();
