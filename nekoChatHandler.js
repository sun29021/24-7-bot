const strategyAdaptor = require('./strategyAdaptor');
const experienceRecorder = require('./experienceRecorder');
const nekoAI = require('./nekoAI');
const memory = require('./memory');
const nekoBehavior = require('./nekoBehavior');

class NekoChatHandler {
  constructor() {
    this.chatHistory = [];
    this.responseCache = new Map();
    this.eventCooldowns = {
      death: 0,
      damage: 0,
      mob: 0,
      mining: 0
    };
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
      
      // Use quick response for common situations
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
   * ANALYZE GAME EVENTS - Minimal Version
   * Handles: death, damage, mobs, mining, discovery
   * ============================================================
   */
  async analyzeGameEvent(event) {
    const { type, data } = event;
    const now = Date.now();
    
    // Initialize cooldowns if not set
    if (!this.eventCooldowns) {
      this.eventCooldowns = {
        death: 0,
        damage: 0,
        mob: 0,
        mining: 0
      };
    }
    
    // Check cooldown
    const cooldownTimes = { death: 60000, damage: 20000, mob: 25000, mining: 15000 };
    if (this.eventCooldowns[type] && (now - this.eventCooldowns[type]) < (cooldownTimes[type] || 20000)) {
      return { shouldChat: false, reason: 'cooldown' };
    }

    try {
      let message = null;
      let shouldChat = true;

      switch (type) {
        case 'death':
          message = `Nah I'm not out, I'll be back.`;
          memory.data.daysAlive = 0;
          memory.saveMemory();
          break;

        case 'damage':
          // Only chat if health < 20%
          if (data.health < 4) {
            message = `Gotta find food NOW.`;
            memory.recordNearDeath();
          } else {
            shouldChat = false;
          }
          break;

        case 'mob_encounter':
          // Only chat if confident or dangerous
          const confidence = memory.data.confidenceLevel || 0;
          const dangerousMobs = ['creeper', 'enderman', 'cave_spider', 'phantom'];
          const isDangerous = (data.mobs || []).some(m => 
            dangerousMobs.some(d => m.name.toLowerCase().includes(d))
          );
          
          if (isDangerous || confidence > 50) {
            message = confidence > 60 ? 'Time for a fight.' : 'Nope, bouncing!';
          } else {
            shouldChat = false;
          }
          break;

        case 'mining_success':
          // Only chat about valuable ores
          const valuableOres = ['diamond', 'emerald', 'ancient_debris', 'gold', 'deepslate_diamond'];
          if (valuableOres.some(ore => data.ore.includes(ore))) {
            message = `${data.ore.toUpperCase()}!! Going in my collection 💎`;
            memory.collectItem(data.ore, data.quantity || 1);
          } else {
            shouldChat = false;
          }
          break;

        default:
          shouldChat = false;
      }

      if (shouldChat && message) {
        this.eventCooldowns[type] = now;
        return {
          shouldChat: true,
          message: message,
          eventType: type
        };
      }

      return { shouldChat: false, reason: 'filtered' };

    } catch (err) {
      // Fail silently to prevent error spam
      console.log(`[NEKO] Event analysis error (${type}):`, err.message);
      return { shouldChat: false, reason: 'error' };
    }
  }

  /**
   * Handle special commands
   */
  async handleCommand(playerName, message, bot) {
    const [cmd, ...args] = message.slice(1).toLowerCase().split(' ');

    const commands = {
      learn: () => {
    const r = strategyAdaptor.getAdaptationReport();
    return `📚 Learning: ${r.adaptationLevel}/10 | Mobs: ${r.knownDangerousMobs} | Zones: ${r.knownSafeZones}`;
  },

  knowledge: () => {
    const s = experienceRecorder.getStats();
    return `🧠 Experiences: ${s.totalEvents} | Mining: ${s.miningEvents} | Combat: ${s.combatEvents}`;
  },

  strategy: () => {
    const m = strategyAdaptor.getMiningStrategy();
    const c = strategyAdaptor.getCombatStrategy();
    return `⚡ Mine Y:${m.targetYLevel} | Fight: ${c.preferredTactic} | Aggression: ${c.aggressiveness}/10`;
  },
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
   * Learn player interactions to improve future responses
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

  /**
   * React to game events
   */
  async reactToGameEvent(eventType, data) {
    const reactions = {
      mob_defeated: `YESSS just destroyed that ${data.mobType}! 💪 I'm getting STRONGER`,
      found_ore: `Found ${data.ore}! Going straight to my collection! 🏛️`,
      took_damage: `OWW that hurt!! But I'm not dying today 😤`,
      found_player: `Yo ${data.playerName}! Didn't know you were here!`,
      built_block: `Another block for my masterpiece! 🧱`,
      died: `NOOOOO I DIEDDD!! But I'll be back stronger fr fr 💪`
    };

    return reactions[eventType] || "Something interesting happened...";
  }
}

module.exports = new NekoChatHandler();
