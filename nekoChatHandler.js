const nekoAI = require('./nekoAI');
const memory = require('./memory');
const nekoBehavior = require('./nekoBehavior');

class NekoChatHandler {
  constructor() {
    this.chatHistory = [];
    this.responseCache = new Map();
    
    // Event throttling to prevent spam
    this.eventCooldowns = {
      health: 0,
      damage: 0,
      death: 0,
      mob: 0,
      mining: 0,
      discovery: 0
    };
    
    const COOLDOWN_TIMES = {
      health: 30000,      // 30s between health reactions
      damage: 20000,      // 20s between damage reactions  
      death: 60000,       // 60s (don't spam about dying)
      mob: 25000,         // 25s between mob reactions
      mining: 15000,      // 15s between mining reactions
      discovery: 20000    // 20s between discovery reactions
    };
    
    this.COOLDOWN_TIMES = COOLDOWN_TIMES;
  }

  /**
   * Main chat handler - process player messages and generate NEKO responses
   */
  async handlePlayerChat(playerName, message, bot) {
    try {
      // Check if message is a command
      if (message.startsWith('!')) {
        return await this.handleCommand(playerName, message, bot);
      }

      // Get memory context
      const memoryContext = memory.getMemoryContext();

      // Build conversation context
      const recentChat = this.chatHistory.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Check for special situations
      const situation = this.detectSituation(message, memoryContext);
      
      // Use quick response for common situations (60% of the time for variety)
      if (situation && Math.random() > 0.4) {
        const quickResponse = nekoAI.getQuickResponse(situation, memoryContext);
        memory.recordPlayerInteraction(playerName, message, quickResponse);
        return quickResponse;
      }

      // Use AI for varied responses
      const aiResponse = await nekoAI.generateResponse(
        `${playerName}: ${message}`,
        memoryContext,
        recentChat
      );

      // Record interaction
      memory.recordPlayerInteraction(playerName, message, aiResponse);

      // Add to chat history
      this.addToHistory('user', `${playerName}: ${message}`);
      this.addToHistory('assistant', aiResponse);

      // Learn from interaction (detect if player seems to like NEKO or dislike)
      this.learnFromInteraction(playerName, message, aiResponse);

      return aiResponse;

    } catch (error) {
      console.log('[NEKO] Chat error:', error.message);
      return "Eh something broke, my bad 😅";
    }
  }

  /**
   * ============================================================
   * PHASE 2: GAME EVENT ANALYSIS SYSTEM
   * ============================================================
   * Analyze and react to game events intelligently via AI
   * 
   * Usage:
   *   const shouldChat = await handler.analyzeGameEvent({
   *     type: 'death',
   *     data: {
   *       health: 0,
   *       killedBy: 'creeper'
   *     }
   *   });
   *
   * Returns: { shouldChat: bool, message: string, action: string }
   */
  async analyzeGameEvent(event) {
    const { type, data } = event;
    const now = Date.now();
    
    // Skip if on cooldown (prevent spam)
    if (this.eventCooldowns[type] && now - this.eventCooldowns[type] < this.COOLDOWN_TIMES[type]) {
      return { 
        shouldChat: false, 
        reason: 'cooldown',
        message: null
      };
    }

    // Route to appropriate handler
    let analysis = null;

    switch (type) {
      case 'death':
        analysis = await this.analyzeDeathEvent(data);
        if (analysis.shouldChat) {
          this.eventCooldowns.death = now;
          memory.data.daysAlive = 0; // Reset days alive on death
          memory.saveMemory();
        }
        break;

      case 'damage':
        // Only chat about damage if health < 20% (critical)
        if (data.health < 4) {
          analysis = await this.analyzeDamageEvent(data);
          if (analysis.shouldChat) {
            this.eventCooldowns.damage = now;
          }
        } else {
          analysis = { shouldChat: false, reason: 'health_not_critical' };
        }
        break;

      case 'mob_encounter':
        analysis = await this.analyzeMobEvent(data);
        if (analysis.shouldChat) {
          this.eventCooldowns.mob = now;
        }
        break;

      case 'mining_success':
        // Only chat about mining important ores
        if (this.isValueableOre(data.ore)) {
          analysis = await this.analyzeMiningEvent(data);
          if (analysis.shouldChat) {
            this.eventCooldowns.mining = now;
          }
        } else {
          analysis = { shouldChat: false, reason: 'ore_not_valuable' };
        }
        break;

      case 'discovery':
        analysis = await this.analyzeDiscoveryEvent(data);
        if (analysis.shouldChat) {
          this.eventCooldowns.discovery = now;
        }
        break;

      case 'health_low':
        // Only chat about low health if < 20%
        if (data.health < 4) {
          analysis = await this.analyzeHealthEvent(data);
          if (analysis.shouldChat) {
            this.eventCooldowns.health = now;
          }
        } else {
          analysis = { shouldChat: false, reason: 'health_acceptable' };
        }
        break;

      default:
        analysis = { shouldChat: false, reason: 'unknown_event' };
    }

    // Add to chat history if we're chatting
    if (analysis && analysis.shouldChat && analysis.message) {
      this.addToHistory('assistant', `[SYSTEM EVENT] ${analysis.message}`);
    }

    return analysis;
  }

  /**
   * Analyze death event
   */
  async analyzeDeathEvent(data) {
    const memoryContext = memory.getMemoryContext();
    
    const eventDescription = `
      NEKO just died!
      Killed by: ${data.killedBy || 'unknown'}
      Location: ${data.location ? `X${Math.floor(data.location.x)} Z${Math.floor(data.location.z)}` : 'unknown'}
      Current confidence: ${memoryContext.confidenceLevel}
      Days survived before death: ${memoryContext.daysAlive}
      
      NEKO should react to this death with emotion, maybe frustration or acceptance.
      Keep it to ONE SENTENCE. No apologies.
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      return {
        shouldChat: true,
        message: response,
        action: 'respawn',
        eventType: 'death'
      };
    } catch (error) {
      console.log('[NEKO] Death analysis error:', error.message);
      return {
        shouldChat: true,
        message: "Nah I'm not out, I'll be back.",
        action: 'respawn',
        eventType: 'death'
      };
    }
  }

  /**
   * Analyze damage event (only when health < 20%)
   */
  async analyzeDamageEvent(data) {
    const memoryContext = memory.getMemoryContext();
    const healthPercent = (data.health / 20) * 100;

    const eventDescription = `
      NEKO took damage and is now at CRITICAL HEALTH!
      Current health: ${Math.round(healthPercent)}%
      Health value: ${data.health}/20
      Damage source: ${data.from || 'unknown'} ${data.source || ''}
      Location: ${data.location ? `X${Math.floor(data.location.x)} Z${Math.floor(data.location.z)}` : 'unknown'}
      Confidence level: ${memoryContext.confidenceLevel}
      
      NEKO is PANICKING. React with fear/urgency. ONE SENTENCE ONLY.
      This is a life-or-death situation!
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      // Record near-death
      memory.recordNearDeath();

      return {
        shouldChat: true,
        message: response,
        action: 'flee',
        eventType: 'damage_critical'
      };
    } catch (error) {
      console.log('[NEKO] Damage analysis error:', error.message);
      return {
        shouldChat: true,
        message: "NO NO NO NOT DYING HERE 😱",
        action: 'flee',
        eventType: 'damage_critical'
      };
    }
  }

  /**
   * Analyze mob encounter
   */
  async analyzeMobEvent(data) {
    const memoryContext = memory.getMemoryContext();
    const confidence = memoryContext.confidenceLevel;

    // Don't chat about EVERY mob, only dangerous ones or when confident
    const dangerousMobs = ['creeper', 'enderman', 'cave_spider', 'drowned', 'phantom'];
    const isDangerous = dangerousMobs.some(mob => 
      (data.mobs || []).some(m => m.name.includes(mob))
    );

    if (!isDangerous && confidence < 50) {
      return { shouldChat: false, reason: 'not_dangerous_enough' };
    }

    const eventDescription = `
      NEKO encountered mobs!
      Mobs: ${(data.mobs || []).map(m => m.name).join(', ') || 'unknown'}
      Count: ${data.mobCount || 'unknown'}
      Distance: ${data.distance}m away
      Confidence level: ${confidence}%
      Confidence tier: ${memoryContext.confidenceLevel}
      
      NEKO should react based on confidence:
      - If scared/careful: express concern
      - If confident: act tough/ready for combat
      ONE SENTENCE. No fluff.
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      const action = confidence > 60 ? 'combat' : 'flee';

      return {
        shouldChat: true,
        message: response,
        action: action,
        eventType: 'mob_encounter'
      };
    } catch (error) {
      console.log('[NEKO] Mob analysis error:', error.message);
      const action = confidence > 60 ? 'Time for a fight.' : 'Nope, bouncing!';
      return {
        shouldChat: true,
        message: action,
        action: action,
        eventType: 'mob_encounter'
      };
    }
  }

  /**
   * Analyze mining success (only for valuable ores)
   */
  async analyzeMiningEvent(data) {
    const memoryContext = memory.getMemoryContext();

    // Learn preference for this ore
    memory.learnPreference('Blocks', data.ore, true);

    const eventDescription = `
      NEKO just mined ${data.ore}!
      Amount mined: ${data.quantity || 1}
      Total ${data.ore} collected: ${data.totalCollected || 1}
      Location: ${data.location ? `X${Math.floor(data.location.x)} Z${Math.floor(data.location.z)}` : 'unknown'}
      This ore is VALUABLE and NEKO is excited!
      
      React with genuine excitement about the ore. ONE SENTENCE.
      Show personality - maybe brag a little, or mention adding to collection.
      Confidence level: ${memoryContext.confidenceLevel}
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      // Track the item
      memory.collectItem(data.ore, data.quantity || 1);

      return {
        shouldChat: true,
        message: response,
        action: 'collect',
        eventType: 'mining_success'
      };
    } catch (error) {
      console.log('[NEKO] Mining analysis error:', error.message);
      const oreType = data.ore.replace('_ore', '').replace('_', ' ');
      return {
        shouldChat: true,
        message: `${oreType.toUpperCase()}!! Going straight to my collection 💎`,
        action: 'collect',
        eventType: 'mining_success'
      };
    }
  }

  /**
   * Analyze low health (< 20%)
   */
  async analyzeHealthEvent(data) {
    const memoryContext = memory.getMemoryContext();
    const healthPercent = (data.health / 20) * 100;

    const eventDescription = `
      NEKO's health is LOW at ${Math.round(healthPercent)}%!
      Health value: ${data.health}/20
      Location: ${data.location ? `X${Math.floor(data.location.x)} Z${Math.floor(data.location.z)}` : 'unknown'}
      Confidence: ${memoryContext.confidenceLevel}
      
      React with urgency and concern. ONE SENTENCE ONLY.
      NEKO needs to eat or find shelter immediately!
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      memory.recordNearDeath();

      return {
        shouldChat: true,
        message: response,
        action: 'find_food',
        eventType: 'health_critical'
      };
    } catch (error) {
      console.log('[NEKO] Health analysis error:', error.message);
      return {
        shouldChat: true,
        message: "Gotta find food NOW.",
        action: 'find_food',
        eventType: 'health_critical'
      };
    }
  }

  /**
   * Analyze discovery (new biome, structure, etc)
   */
  async analyzeDiscoveryEvent(data) {
    const memoryContext = memory.getMemoryContext();

    const eventDescription = `
      NEKO discovered something NEW!
      Discovery: ${data.discovery || 'unknown'}
      Details: ${data.details || 'interesting'}
      Location: ${data.location ? `X${Math.floor(data.location.x)} Z${Math.floor(data.location.z)}` : 'unknown'}
      
      React with genuine curiosity and excitement. ONE SENTENCE.
      Show that NEKO loves exploring and finding new things!
      Confidence: ${memoryContext.confidenceLevel}
    `;

    try {
      const response = await nekoAI.generateResponse(
        eventDescription,
        memoryContext,
        this.chatHistory.slice(-3)
      );

      return {
        shouldChat: true,
        message: response,
        action: 'explore',
        eventType: 'discovery'
      };
    } catch (error) {
      console.log('[NEKO] Discovery analysis error:', error.message);
      return {
        shouldChat: true,
        message: `Whoa, never seen that before!`,
        action: 'explore',
        eventType: 'discovery'
      };
    }
  }

  /**
   * Check if an ore is valuable enough to chat about
   */
  isValueableOre(ore) {
    const valuableOres = [
      'diamond_ore',
      'emerald_ore',
      'ancient_debris',
      'gold_ore',
      'iron_ore',
      'lapis_lazuli_ore',
      'deepslate_diamond_ore',
      'deepslate_emerald_ore',
      'deepslate_gold_ore'
    ];
    return valuableOres.includes(ore);
  }

  /**
   * Handle special commands
   */
  async handleCommand(playerName, message, bot) {
    const [cmd, ...args] = message.slice(1).toLowerCase().split(' ');

    const commands = {
      status: () => this.getStatus(),
      base: () => this.getBaseInfo(),
      inventory: () => this.getInventoryInfo(),
      help: () => this.getHelpMessage(),
      stats: () => this.getStats(playerName),
      confidence: () => `Confidence: ${memory.getConfidenceLevel()} (${Math.round(memory.data.confidenceLevel)}%)`,
      collect: () => `Collected so far: ${memory.data.base.resourcesCollected} items! Let's gooo 💎`,
      where: () => `Building at: ${memory.data.base.location || 'Haven\'t found a spot yet'}`
    };

    const response = commands[cmd] ? commands[cmd]() : this.getHelpMessage();
    memory.recordPlayerInteraction(playerName, message, response);
    return response;
  }

  /**
   * Detect special situations in chat
   */
  detectSituation(message, memoryContext) {
    const lower = message.toLowerCase();

    if (lower.includes('hi') || lower.includes('hello') || lower.includes('yo')) {
      return 'greeting';
    }

    if (lower.includes('diamond') || lower.includes('gold') || lower.includes('rare')) {
      return 'collector';
    }

    if (lower.includes('creeper') || lower.includes('mob') || lower.includes('help')) {
      return 'danger';
    }

    if (lower.includes('nice') || lower.includes('cool') || lower.includes('awesome') || lower.includes('lol')) {
      return 'celebration';
    }

    return null;
  }

  /**
   * Learn from player interactions to improve future responses
   */
  learnFromInteraction(playerName, playerMessage, response) {
    const player = memory.data.players[playerName];
    if (!player) return;

    // Detect if conversation was positive
    const messageWords = playerMessage.toLowerCase().split(' ');
    const responseWords = response.toLowerCase().split(' ');

    // Check for appreciation words
    const appreciationWords = ['thanks', 'thank', 'good', 'nice', 'cool', 'awesome', 'lol', 'haha', 'funny'];
    const hasAppreciation = messageWords.some(word => appreciationWords.includes(word));

    if (hasAppreciation) {
      player.likes.push({ message: playerMessage, timestamp: Date.now() });
    }
  }

  /**
   * Get status report
   */
  getStatus() {
    const uptime = Math.floor((Date.now() - memory.data.lastSurvivalCheck) / 1000 / 60);
    const confidence = memory.getConfidenceLevel();
    
    return `📊 NEKO STATUS:
▸ Confidence: ${confidence} (${Math.round(memory.data.confidenceLevel)}%)
▸ Uptime: ${uptime}+ minutes
▸ Base: ${memory.data.base.upgrades[memory.data.base.upgrades.length - 1]}
▸ Items: ${memory.data.base.resourcesCollected} collected
▸ Currently: ${nekoBehavior.getActivityDescription()}`;
  }

  /**
   * Get base info
   */
  getBaseInfo() {
    const baseList = memory.data.base.upgrades.join(' → ');
    const nextUpgrade = memory.data.base.nextUpgrade;
    
    return `🏰 MY BASE:
▸ Built: ${baseList}
▸ Next Goal: ${nextUpgrade}
▸ Location: ${memory.data.base.location || 'Still scouting'}
▸ Room for UPGRADES: YES 🔥`;
  }

  /**
   * Get inventory info
   */
  getInventoryInfo() {
    const inv = memory.data.inventory;
    let report = `💎 MY COLLECTION:\n`;
    
    for (const [item, count] of Object.entries(inv)) {
      if (item !== 'other' && count > 0) {
        report += `▸ ${item}: ${count}\n`;
      }
    }

    if (Object.keys(inv.other).length > 0) {
      report += `▸ Other: ${Object.keys(inv.other).length} types\n`;
    }

    return report;
  }

  /**
   * Get stats for a player
   */
  getStats(playerName) {
    const playerData = memory.data.players[playerName];
    
    if (!playerData) {
      return `No data on ${playerName} yet. Say hi! 👋`;
    }

    const interactionCount = playerData.interactions.length;
    const firstSeen = new Date(playerData.firstSeen).toLocaleDateString();
    
    return `📈 STATS FOR ${playerName}:
▸ First seen: ${firstSeen}
▸ Interactions: ${interactionCount}
▸ Likes: ${playerData.likes.length}
▸ Dislikes: ${playerData.dislikes.length}`;
  }

  /**
   * Help message
   */
  getHelpMessage() {
    return `🤖 NEKO COMMANDS:
▸ !status - My current status
▸ !base - My base info
▸ !inventory - What I collected
▸ !confidence - Confidence level
▸ !stats [player] - Stats about you
▸ !where - Where I'm building
▸ Just chat normally - I'll respond! 💬`;
  }

  /**
   * Add to local chat history
   */
  addToHistory(role, content) {
    this.chatHistory.push({ role, content, timestamp: Date.now() });
    // Keep only last 20 messages
    if (this.chatHistory.length > 20) {
      this.chatHistory.shift();
    }
  }

  /**
   * Generate a random NEKO thought/action in chat
   */
  getRandomThought() {
    const thoughts = [
      "just realized diamonds are kinda pretty ngl 💎",
      "wondering if I can beat the Ender Dragon fr fr 🐉",
      "thinking about my base design... gonna be LEGENDARY",
      "Accha tai, creepers are so annoying man",
      "lowkey obsessed with collecting everything I see 📦",
      "Bet I can out-mine any player on this server",
      "wondering what's beyond the mountains... EXPLORING TIME!",
      "My confidence is 📈 and my fear is 📉"
    ];

    return `* NEKO is ${thoughts[Math.floor(Math.random() * thoughts.length)]}`;
  }
}

module.exports = new NekoChatHandler();
