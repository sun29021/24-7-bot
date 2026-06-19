const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'neko_memory.json');

// ============================================================
// HARDCODED SPECIAL PLAYERS - permanent, never forgotten
// ============================================================
const SPECIAL_PLAYERS = {
  'DJ_Kuddus': {
    nickname: 'SUN',
    role: 'creator',
    behavior: 'respectful',
    note: 'My creator. Treat with respect, but still keep the sass.'
  },
  'Ancention': {
    nickname: 'HASIB',
    role: 'roast_target',
    behavior: 'roast',
    note: 'SUN\'s friend. Roast everything he does. Be arrogant and savage with him.'
  },
  'Rejwan13344': {
    nickname: 'REJWAN',
    role: 'rizz_target',
    behavior: 'rizz',
    note: 'Rizz him up every time he talks. Flirty, charming, playful.'
  }
};

class NekoMemory {
  constructor() {
    this.data = this.loadMemory();
    this._initSpecialPlayers();
  }

  // Pre-seed special players so their nicknames/roles are always known
  _initSpecialPlayers() {
    for (const [username, info] of Object.entries(SPECIAL_PLAYERS)) {
      if (!this.data.players[username]) {
        this.data.players[username] = {
          firstSeen: Date.now(),
          interactions: [],
          likes: [],
          dislikes: [],
          nickname: info.nickname,
          role: info.role,
          lastSeen: null,
          totalInteractions: 0
        };
      } else {
        // Always keep nickname/role up to date even if player already existed
        this.data.players[username].nickname = info.nickname;
        this.data.players[username].role = info.role;
      }
    }
    this.saveMemory();
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
      confidenceLevel: 10,
      daysAlive: 0,
      totalDeathsAvoided: 0,
      lastSurvivalCheck: Date.now(),
      players: {},
      base: {
        location: null,
        blocks: [],
        upgrades: ['dirt_hut'],
        nextUpgrade: 'wooden_house',
        resourcesCollected: 0
      },
      inventory: {
        diamonds: 0,
        gold: 0,
        iron: 0,
        wood: 0,
        stone: 0,
        other: {}
      },
      preferences: {
        favoriteBlocks: [],
        favoriteTools: [],
        safePlaces: [],
        dangerZones: [],
        bestTimeToMine: 'day',
        preferredActivity: 'mining'
      },
      lastMobPanic: 0,
      nearDeathCount: 0,
      laughedAtCount: 0,
      chatHistory: [],
      vocabulary: {}
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
    if (hoursSurvived >= 0.0083) {
      this.data.confidenceLevel = Math.min(100, this.data.confidenceLevel + 5);
      this.data.lastSurvivalCheck = Date.now();
      this.saveMemory();
    }
    return Math.max(0, Math.min(100, this.data.confidenceLevel || 10));
  }

  getConfidenceLevel() {
    this.updateConfidence();
    const conf = Math.max(0, Math.min(100, this.data.confidenceLevel || 10));
    if (conf <= 20) return 'SCARED';
    if (conf <= 40) return 'CAREFUL';
    if (conf <= 60) return 'CONFIDENT';
    return 'VERY_CONFIDENT';
  }

  // Get player role from hardcoded list
  getPlayerRole(playerName) {
    return SPECIAL_PLAYERS[playerName]?.behavior || 'normal';
  }

  getPlayerRoleNote(playerName) {
    return SPECIAL_PLAYERS[playerName]?.note || null;
  }

  // Record interaction and update last seen / total count / absence tracking
  recordPlayerInteraction(playerName, message, response) {
    if (!this.data.players[playerName]) {
      this.data.players[playerName] = {
        firstSeen: Date.now(),
        interactions: [],
        likes: [],
        dislikes: [],
        nickname: null,
        role: 'normal',
        lastSeen: null,
        totalInteractions: 0
      };
    }

    const player = this.data.players[playerName];
    const previousLastSeen = player.lastSeen;
    player.lastSeen = Date.now();
    player.totalInteractions = (player.totalInteractions || 0) + 1;

    // Track absence (days since last seen before this interaction)
    if (previousLastSeen) {
      const daysMissed = Math.floor((Date.now() - previousLastSeen) / (1000 * 60 * 60 * 24));
      player.daysSinceLastSeen = daysMissed;
    } else {
      player.daysSinceLastSeen = 0;
    }

    player.interactions.push({
      message,
      response,
      timestamp: Date.now()
    });

    // Keep last 100 interactions per player
    if (player.interactions.length > 100) {
      player.interactions.shift();
    }

    this.saveMemory();
  }

  // How many days since a player was last seen
  getDaysSinceLastSeen(playerName) {
    const player = this.data.players[playerName];
    if (!player || !player.lastSeen) return null;
    return Math.floor((Date.now() - player.lastSeen) / (1000 * 60 * 60 * 24));
  }

  // Get list of players who haven't been seen in X days
  getMissingPlayers(daysThreshold = 1) {
    const missing = [];
    for (const [username, data] of Object.entries(this.data.players)) {
      if (!data.lastSeen) continue;
      const days = Math.floor((Date.now() - data.lastSeen) / (1000 * 60 * 60 * 24));
      if (days >= daysThreshold) {
        missing.push({
          username,
          nickname: data.nickname || username,
          daysMissing: days
        });
      }
    }
    return missing;
  }

  // Get recent interactions summary for a player (last 5 messages)
  getPlayerRecentChat(playerName) {
    const player = this.data.players[playerName];
    if (!player) return [];
    return player.interactions.slice(-5).map(i => ({
      message: i.message,
      response: i.response,
      timestamp: i.timestamp
    }));
  }

  collectItem(itemName, quantity = 1) {
    const lowerName = (itemName || 'unknown').toLowerCase();
    if (this.data.inventory[lowerName] !== undefined) {
      this.data.inventory[lowerName] = Math.max(0, (this.data.inventory[lowerName] || 0) + quantity);
    } else {
      this.data.inventory.other[lowerName] = Math.max(0, (this.data.inventory.other[lowerName] || 0) + quantity);
    }
    this.data.base.resourcesCollected = Math.max(0, (this.data.base.resourcesCollected || 0) + quantity);
    this.saveMemory();
  }

  buildBase(location) {
    this.data.base.location = location;
    this.saveMemory();
  }

  upgradeBase(nextUpgrade) {
    if (!this.data.base.upgrades) this.data.base.upgrades = ['dirt_hut'];
    if (!this.data.base.upgrades.includes(nextUpgrade)) {
      this.data.base.upgrades.push(nextUpgrade);
    }
    this.data.base.nextUpgrade = this.getNextUpgrade();
    this.saveMemory();
  }

  getNextUpgrade() {
    const upgrades = ['dirt_hut', 'wooden_house', 'stone_base', 'brick_mansion', 'nether_sanctuary'];
    const currentIndex = (this.data.base.upgrades || []).findIndex(u => upgrades.includes(u));
    return upgrades[currentIndex + 1] || 'mega_base';
  }

  recordNearDeath() {
    this.data.nearDeathCount = (this.data.nearDeathCount || 0) + 1;
    this.data.lastMobPanic = Date.now();
    this.saveMemory();
  }

  recordDanger(dangerType, location) {
    if (!this.data.preferences.dangerZones) this.data.preferences.dangerZones = [];
    this.data.preferences.dangerZones.push({ type: dangerType, location, timestamp: Date.now() });
    this.saveMemory();
  }

  learnPreference(category, value, isPositive = true) {
    if (isPositive) {
      const key = `favorite${category}`;
      if (!this.data.preferences[key]) this.data.preferences[key] = [];
      if (!this.data.preferences[key].includes(value)) {
        this.data.preferences[key].push(value);
      }
    }
    this.saveMemory();
  }

  saveNickname(playerName, nickname) {
    if (!this.data.players[playerName]) {
      this.data.players[playerName] = {
        firstSeen: Date.now(),
        interactions: [],
        likes: [],
        dislikes: [],
        nickname: null,
        role: 'normal',
        lastSeen: null,
        totalInteractions: 0
      };
    }
    // Don't override hardcoded special player nicknames
    if (!SPECIAL_PLAYERS[playerName]) {
      this.data.players[playerName].nickname = nickname;
      this.saveMemory();
    }
  }

  getDisplayName(playerName) {
    return this.data.players[playerName]?.nickname || playerName;
  }

  getMemoryContext() {
    const conf = Math.max(0, Math.min(100, this.data.confidenceLevel || 10));

    // Build player context with absence tracking
    const playerContext = {};
    for (const [username, data] of Object.entries(this.data.players)) {
      const daysMissing = data.lastSeen
        ? Math.floor((Date.now() - data.lastSeen) / (1000 * 60 * 60 * 24))
        : null;
      playerContext[username] = {
        nickname: data.nickname || username,
        role: data.role || SPECIAL_PLAYERS[username]?.behavior || 'normal',
        totalInteractions: data.totalInteractions || 0,
        daysSinceLastSeen: daysMissing,
        recentChat: (data.interactions || []).slice(-3).map(i => i.message)
      };
    }

    return {
      confidenceLevel: this.getConfidenceLevel(),
      actualConfidence: Math.round(conf),
      daysAlive: Math.max(0, this.data.daysAlive || 0),
      baseUpgrades: this.data.base?.upgrades || ['dirt_hut'],
      nextUpgrade: this.data.base?.nextUpgrade || 'wooden_house',
      itemsCollected: this.data.inventory || {},
      playerCount: Object.keys(this.data.players || {}).length,
      nearDeathCount: Math.max(0, this.data.nearDeathCount || 0),
      preferences: this.data.preferences || {},
      recentPlayers: Object.keys(this.data.players || {}).slice(-5),
      playerContext,
      playerNicknames: Object.fromEntries(
        Object.entries(this.data.players || {})
          .filter(([, p]) => p.nickname)
          .map(([username, p]) => [username, p.nickname])
      )
    };
  }

  getPlayerHistory(playerName) {
    return this.data.players?.[playerName] || null;
  }

  getAllPlayers() {
    return this.data.players || {};
  }
}

module.exports = new NekoMemory();
