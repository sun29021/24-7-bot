const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'neko_memory.json');

class NekoMemory {
  constructor() {
    this.data = this.loadMemory();
  }

  loadMemory() {
    try {
      if (fs.existsSync(MEMORY_FILE)) {
        return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      }
    } catch (e) {
      console.log('[NEKO] Memory corrupted, starting fresh');
    }

    return {
      // Personality & Growth
      confidenceLevel: 1,
      daysAlive: 0,
      totalDeathsAvoided: 0,
      lastSurvivalCheck: Date.now(),

      // Players
      players: {}, // { playerName: { firstSeen, interactions: [], likes: [], dislikes: [] } }

      // Base & Building
      base: {
        location: null,
        blocks: [],
        upgrades: ['dirt_hut'],
        nextUpgrade: 'wooden_house',
        resourcesCollected: 0
      },

      // Collection
      inventory: {
        diamonds: 0,
        gold: 0,
        iron: 0,
        wood: 0,
        stone: 0,
        other: {}
      },

      // Preferences learned
      preferences: {
        favoriteBlocks: [],
        favoriteTools: [],
        safePlaces: [],
        dangerZones: [],
        bestTimeToMine: 'day',
        preferredActivity: 'mining'
      },

      // Emotions & Reactions
      lastMobPanic: 0,
      nearDeathCount: 0,
      laughedAtCount: 0,

      // Chat memory
      chatHistory: [], // { player, message, response, timestamp }
      vocabulary: {}  // learned slang/phrases
    };
  }

  saveMemory() {
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.log('[NEKO] Failed to save memory:', e.message);
    }
  }

  // Confidence grows with survival
  updateConfidence() {
    const hoursSurvived = (Date.now() - this.data.lastSurvivalCheck) / (1000 * 60 * 60);
    if (hoursSurvived >= 0.0083) {  // 30 seconds instead of 1 hour
      this.data.confidenceLevel = Math.min(100, this.data.confidenceLevel + 5);  // +5 per 30 seconds
      this.data.lastSurvivalCheck = Date.now();
      this.saveMemory();
    }
    return this.data.confidenceLevel;
  }

  getConfidenceLevel() {
    this.updateConfidence();
    if (this.data.confidenceLevel <= 20) return 'SCARED';
    if (this.data.confidenceLevel <= 40) return 'CAREFUL';
    if (this.data.confidenceLevel <= 60) return 'CONFIDENT';
    return 'VERY_CONFIDENT';
  }

  // Player interaction tracking
  recordPlayerInteraction(playerName, message, response) {
    if (!this.data.players[playerName]) {
      this.data.players[playerName] = {
        firstSeen: Date.now(),
        interactions: [],
        likes: [],
        dislikes: []
      };
    }

    this.data.players[playerName].interactions.push({
      message,
      response,
      timestamp: Date.now()
    });

    // Keep last 50 interactions per player
    if (this.data.players[playerName].interactions.length > 50) {
      this.data.players[playerName].interactions.shift();
    }

    this.saveMemory();
  }

  // Collection tracking
  collectItem(itemName, quantity = 1) {
    const lowerName = itemName.toLowerCase();
    
    if (this.data.inventory[lowerName] !== undefined) {
      this.data.inventory[lowerName] += quantity;
    } else {
      this.data.inventory.other[lowerName] = (this.data.inventory.other[lowerName] || 0) + quantity;
    }

    this.data.base.resourcesCollected += quantity;
    this.saveMemory();
  }

  // Base building
  buildBase(location) {
    this.data.base.location = location;
    this.saveMemory();
  }

  upgradeBase(nextUpgrade) {
    this.data.base.upgrades.push(nextUpgrade);
    this.data.base.nextUpgrade = this.getNextUpgrade();
    this.saveMemory();
  }

  getNextUpgrade() {
    const upgrades = ['dirt_hut', 'wooden_house', 'stone_base', 'brick_mansion', 'nether_sanctuary'];
    const currentIndex = upgrades.findIndex(u => this.data.base.upgrades.includes(u));
    return upgrades[currentIndex + 1] || 'mega_base';
  }

  // Danger tracking
  recordNearDeath() {
    this.data.nearDeathCount++;
    this.data.lastMobPanic = Date.now();
    this.saveMemory();
  }

  recordDanger(dangerType, location) {
    this.data.preferences.dangerZones.push({
      type: dangerType,
      location,
      timestamp: Date.now()
    });
    this.saveMemory();
  }

  // Learning preferences
  learnPreference(category, value, isPositive = true) {
    if (isPositive) {
      if (!this.data.preferences[`favorite${category}`]) {
        this.data.preferences[`favorite${category}`] = [];
      }
      if (!this.data.preferences[`favorite${category}`].includes(value)) {
        this.data.preferences[`favorite${category}`].push(value);
      }
    }
    this.saveMemory();
  }

  // Get memory context for AI
  getMemoryContext() {
    return {
      confidenceLevel: this.getConfidenceLevel(),
      actualConfidence: Math.round(this.data.confidenceLevel),
      daysAlive: this.data.daysAlive,
      baseUpgrades: this.data.base.upgrades,
      nextUpgrade: this.data.base.nextUpgrade,
      itemsCollected: this.data.inventory,
      playerCount: Object.keys(this.data.players).length,
      nearDeathCount: this.data.nearDeathCount,
      preferences: this.data.preferences,
      recentPlayers: Object.keys(this.data.players).slice(-5)
    };
  }

  getPlayerHistory(playerName) {
    return this.data.players[playerName] || null;
  }

  getAllPlayers() {
    return this.data.players;
  }
}

module.exports = new NekoMemory();
