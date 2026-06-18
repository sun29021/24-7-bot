const memory = require('./memory');

class NekoBehavior {
  constructor() {
    this.currentActivity = 'idle';
    this.isInDanger = false;
    this.baseLocation = null;
  }

  // Decide what to do based on game state
  decideBehavior(bot, environment) {
    const healthPercent = (bot.health / 20) * 100;
    const confidence = memory.getConfidenceLevel();

    // PRIORITY 1: Survival
    if (bot.health < 5) {
      return { action: 'PANIC_FLEE', reason: 'critical_health' };
    }

    if (environment.nearbyMobs && environment.nearbyMobs.length > 0) {
      if (confidence === 'SCARED' || confidence === 'CAREFUL') {
        return { action: 'FLEE', reason: 'mobs_detected' };
      } else {
        return { action: 'COMBAT', reason: 'confident_in_combat' };
      }
    }

    // PRIORITY 2: Essentials
    if (healthPercent < 50) {
      return { action: 'FIND_FOOD', reason: 'low_health' };
    }

    // PRIORITY 3: Base building (after first day)
    if (memory.data.daysAlive > 1) {
      if (Math.random() > 0.7) {
        return { action: 'BUILD_BASE', reason: 'time_to_upgrade' };
      }
    }

    // PRIORITY 4: Collecting & Mining
    if (Math.random() > 0.5) {
      return { action: 'MINE', reason: 'resource_gathering' };
    }

    // PRIORITY 5: Explore
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
    if (memory.data.preferences.favoriteBlocks.length > 0) {
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
    const items = bot.inventory.items();
    let collected = 0;

    for (const item of items) {
      memory.collectItem(item.name, item.count);
      collected += item.count;
    }

    return {
      type: 'collection',
      itemsCollected: collected,
      total: memory.data.base.resourcesCollected
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

    const currentUpgradeIndex = upgradePath.findIndex(
      u => memory.data.base.upgrades.includes(u.name)
    );
    
    const nextUpgrade = upgradePath[currentUpgradeIndex + 1];

    if (!nextUpgrade) {
      return { type: 'building', status: 'already_maxed', message: 'Already have ULTIMATE BASE!' };
    }

    // Check if we have enough resources
    const hasResources = nextUpgrade.requires.every(resource => {
      return memory.data.inventory[resource] > (10 + currentUpgradeIndex * 5);
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
    const confidence = memory.data.confidenceLevel;
    
    return {
      type: 'combat',
      confidence: Math.round(confidence),
      aggressive: confidence > 50,
      message: confidence > 50 ? 'Time to show these mobs who is BOSS 💪' : 'Gonna be careful here...'
    };
  }

  // Exploration behavior
  async explore(bot) {
    const newLocation = {
      x: bot.entity.position.x + (Math.random() - 0.5) * 200,
      z: bot.entity.position.z + (Math.random() - 0.5) * 200
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
        `I've been alive for ${memory.data.daysAlive} days! I'm basically a Minecraft pro now 😎`,
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
