const memory = require('./memory');

class NekoBehavior {
  constructor() {
    this.currentActivity = 'idle';
    this.isInDanger = false;
    this.baseLocation = null;
  }

  // Decide what to do based on game state - THIS IS THE CORE DECISION MAKER
  decideBehavior(bot, environment) {
    if (!bot) return { action: 'IDLE', reason: 'no_bot' };
    
    const healthPercent = (bot.health / 20) * 100;
    const confidence = memory.getConfidenceLevel();
    const mobs = environment?.nearbyMobs || [];
    const players = environment?.nearbyPlayers || [];

    // PRIORITY 1: Survival from mobs
    if (mobs && mobs.length > 0) {
      if (confidence === 'SCARED' || confidence === 'CAREFUL') {
        return { action: 'FLEE', reason: `${mobs.length}_mobs_nearby` };
      } else if (confidence === 'VERY_CONFIDENT') {
        return { action: 'COMBAT', reason: 'confident_vs_mobs' };
      }
    }

    // PRIORITY 2: Critical health
    if (bot.health < 5) {
      return { action: 'FIND_FOOD', reason: 'critical_health' };
    }

    if (healthPercent < 50) {
      return { action: 'FIND_FOOD', reason: 'low_health' };
    }

    // PRIORITY 3: Base building (after surviving initial danger)
    if (memory.data.daysAlive > 1 && Math.random() > 0.75) {
      return { action: 'BUILD_BASE', reason: 'base_upgrade_cycle' };
    }

    // PRIORITY 4: Mining (most common activity)
    if (Math.random() > 0.4) {
      return { action: 'MINE', reason: 'grinding_resources' };
    }

    // PRIORITY 5: Exploration
    return { action: 'EXPLORE', reason: 'curiosity' };
  }

  // Execute mining behavior
  async performMining(bot) {
    const blocks = [
      { name: 'diamond_ore', value: 100 },
      { name: 'gold_ore', value: 50 },
      { name: 'iron_ore', value: 30 },
      { name: 'stone', value: 5 },
      { name: 'coal_ore', value: 10 }
    ];

    // Preference learning - mine what worked well before
    let targetBlock = blocks[0].name;
    if (memory.data.preferences.favoriteBlocks && memory.data.preferences.favoriteBlocks.length > 0) {
      targetBlock = memory.data.preferences.favoriteBlocks[0];
    } else {
      targetBlock = blocks[Math.floor(Math.random() * blocks.length)].name;
    }

    return {
      type: 'mining',
      target: targetBlock,
      reason: 'grinding for resources'
    };
  }

  // Collect items
  async collectItems(bot) {
    if (!bot || !bot.inventory) return { type: 'collection', itemsCollected: 0, total: 0 };
    
    const items = bot.inventory.items() || [];
    let collected = 0;

    for (const item of items) {
      if (item && item.name) {
        memory.collectItem(item.name, item.count || 1);
        collected += item.count || 1;
      }
    }

    return {
      type: 'collection',
      itemsCollected: collected,
      total: memory.data.base.resourcesCollected || 0
    };
  }

  // Base building logic
  async buildBase(bot) {
    const upgradePath = [
      { name: 'dirt_hut', requires: ['dirt', 'wood'], description: 'simple shelter' },
      { name: 'wooden_house', requires: ['wood', 'stone'], description: 'cozy wooden home' },
      { name: 'stone_base', requires: ['stone', 'iron'], description: 'fortress of stone' },
      { name: 'brick_mansion', requires: ['brick', 'diamonds'], description: 'luxurious mansion' },
      { name: 'nether_sanctuary', requires: ['netherite', 'obsidian'], description: 'ULTIMATE BASE' }
    ];

    const currentUpgrades = memory.data.base?.upgrades || ['dirt_hut'];
    const currentUpgradeIndex = upgradePath.findIndex(
      u => currentUpgrades.includes(u.name)
    );
    
    const nextUpgrade = upgradePath[currentUpgradeIndex + 1];

    if (!nextUpgrade) {
      return { type: 'building', status: 'already_maxed', message: 'Already have ULTIMATE BASE!' };
    }

    // Check if we have enough resources
    const inv = memory.data.inventory || { diamonds: 0, gold: 0, iron: 0, wood: 0, stone: 0, other: {} };
    const hasResources = nextUpgrade.requires.every(resource => {
      const amount = inv[resource] || 0;
      return amount > (10 + currentUpgradeIndex * 5);
    });

    if (hasResources) {
      memory.upgradeBase(nextUpgrade.name);
      return {
        type: 'building',
        upgraded: true,
        newBase: nextUpgrade.name,
        description: nextUpgrade.description
      };
    }

    return {
      type: 'building',
      upgraded: false,
      needed: nextUpgrade.requires,
      message: `Need more resources for ${nextUpgrade.description}`
    };
  }

  // Flee from danger
  async fleeDanger(bot) {
    memory.recordNearDeath();
    return {
      type: 'survival',
      action: 'fleeing',
      message: 'NOPE NOPE NOPE NOT TODAY'
    };
  }

  // Fight mobs
  async combatMobs(bot) {
    const confidence = memory.data.confidenceLevel || 10;
    
    return {
      type: 'combat',
      confidence: Math.round(confidence),
      aggressive: confidence > 50,
      message: confidence > 50 ? 'Time to show these mobs who is BOSS 💪' : 'Gonna be careful here...'
    };
  }

  // Exploration behavior
  async explore(bot) {
    if (!bot || !bot.entity) return { type: 'exploration', reason: 'no_position' };
    
    const pos = bot.entity.position;
    const newLocation = {
      x: pos.x + (Math.random() - 0.5) * 200,
      z: pos.z + (Math.random() - 0.5) * 200
    };

    return {
      type: 'exploration',
      destination: newLocation,
      reason: 'curious about what\'s out there'
    };
  }

  // Learn from experience
  recordExperience(eventType, outcome, details = {}) {
    switch (eventType) {
      case 'mining':
        if (outcome === 'success') {
          memory.learnPreference('Blocks', details.block, true);
        }
        break;

      case 'combat':
        if (outcome === 'died') {
          memory.recordDanger(details.mobType, details.location);
        } else if (outcome === 'won') {
          memory.learnPreference('Combat', 'can_fight', true);
        }
        break;

      case 'safe_location':
        if (!memory.data.preferences.safePlaces) {
          memory.data.preferences.safePlaces = [];
        }
        memory.data.preferences.safePlaces.push({
          location: details.location,
          timestamp: Date.now()
        });
        memory.saveMemory();
        break;

      case 'item_value':
        // Learn which items are valuable
        if (details.rarity === 'rare') {
          memory.learnPreference('Items', details.itemName, true);
        }
        break;
    }
  }

  // Generate emotion-based text for chat
  getEmotionalResponse(situation, context = {}) {
    const responses = {
      found_diamonds: [
        "YASSSSSS DIAMONDS!! 💎💎 I'm literally the luckiest bot alive!",
        "Oye dekh diamonds! Eita na! My base gonna be FIRE 🔥",
        "Nooo wayy!! Lucky day for NEKO fr fr ✨"
      ],
      found_gold: [
        "Gold! Not bad not bad, going in the collection 💛",
        "Accha tai, this will look good in my base ngl",
        "Gold is mid but I'll take it 🙃"
      ],
      almost_died: [
        "BRO THAT WAS CLOSE 😱 Never doing that again!!",
        "Eita kisu na... I almost became a goner just now",
        "Okay okay okay I'm actually kinda scared rn 😰"
      ],
      survived_long: [
        `I've been alive for ${memory.data.daysAlive || 0} days! I'm basically a Minecraft pro now 😎`,
        "Getting better every day fr fr. This bot is unstoppable!",
        "Nah I got this. Confidence 📈 Fear 📉"
      ],
      base_upgrade: [
        "MY NEW BASE LOOKS INSANE!! Best builder in the server 🏰",
        `Upgraded to ${context.upgradeName}! Told you I was built different 💪`,
        "Eita dekh, amra builders na! Look at this masterpiece ✨"
      ]
    };

    const responseList = responses[situation] || responses.found_gold;
    return responseList[Math.floor(Math.random() * responseList.length)];
  }

  // Get current activity description
  getActivityDescription() {
    const activities = {
      idle: 'just chilling tbh',
      mining: 'grinding for resources 💪',
      building: 'designing my masterpiece 🎨',
      exploring: 'discovering new places 🗺️',
      combat: 'fighting mobs (wish me luck)',
      fleeing: 'RUNNING FOR MY LIFE',
      collecting: 'organizing my hoard 📦'
    };

    return activities[this.currentActivity] || 'existing (is that enough?)';
  }
}

module.exports = new NekoBehavior();
