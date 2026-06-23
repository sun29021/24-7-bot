"use strict";
const skinManager = require("./skinManager");

// Owner configuration - ONLY THIS PLAYER CAN CHANGE SKINS
const OWNER_NAME = "DJ_Kuddus"; // Change this to your in-game name

class SkinCommandHandler {
  constructor() {
    this.lastSkinChange = 0;
    this.skinChangeCooldown = 2000; // 2 second cooldown to prevent spam
  }

  /**
   * Check if a player is the bot owner
   * @param {string} playerName - The player's in-game name
   * @returns {boolean} - True if player is the owner
   */
  isOwner(playerName) {
    return playerName.toLowerCase() === OWNER_NAME.toLowerCase();
  }

  /**
   * Handle skin command from chat
   * @param {Object} bot - The mineflayer bot instance
   * @param {string} username - Player who sent the command
   * @param {string} message - Full chat message
   * @returns {boolean} - True if command was handled
   */
  handleCommand(bot, username, message) {
    const trimmed = message.trim().toLowerCase();

    // Check for !skin command
    if (!trimmed.startsWith("!skin")) {
      return false;
    }

    // Owner-only check
    if (!this.isOwner(username)) {
      bot.chat(`❌ Only ${OWNER_NAME} can use skin commands!`);
      console.log(`[SkinCommand] ${username} tried to use skin command (denied)`);
      return true;
    }

    // Cooldown check
    const now = Date.now();
    if (now - this.lastSkinChange < this.skinChangeCooldown) {
      bot.chat("⏳ Please wait before changing skin again...");
      return true;
    }

    // Parse skin name
    const parts = message.trim().split(" ");
    if (parts.length < 2) {
      // Show available skins
      const available = skinManager.getAvailableSkins();
      if (available.length === 0) {
        bot.chat("❌ No skins available. Add skins to /skins folder.");
      } else {
        bot.chat(`📋 Available skins: ${available.join(", ")}`);
      }
      return true;
    }

    const skinName = parts[1];

    // Attempt to change skin
    skinManager.changeSkin(skinName, (success, message) => {
      this.lastSkinChange = Date.now();
      
      if (success) {
        console.log(`[SkinCommand] Skin changed to: ${skinName} by ${username}`);
        bot.chat(`✅ ${message}`);
      } else {
        console.log(`[SkinCommand] Skin change failed: ${message}`);
        bot.chat(`❌ ${message}`);
      }
    });

    return true;
  }

  /**
   * Handle commands from console input
   * @param {Object} bot - The mineflayer bot instance
   * @param {string} input - Console input line
   * @returns {boolean} - True if command was handled
   */
  handleConsoleCommand(bot, input) {
    if (!input.toLowerCase().startsWith("skin")) {
      return false;
    }

    const parts = input.split(" ");

    if (parts.length < 2) {
      // Show available skins
      const available = skinManager.getAvailableSkins();
      console.log(`[SkinManager] Available skins: ${available.join(", ")}`);
      console.log(`[SkinManager] Current skin: ${skinManager.getCurrentSkinName()}`);
      return true;
    }

    const skinName = parts[1];
    skinManager.changeSkin(skinName, (success, message) => {
      console.log(`[SkinManager] ${message}`);
    });

    return true;
  }

  /**
   * Reset to default skin
   */
  resetToDefault(bot) {
    skinManager.resetToDefault();
    if (bot) {
      bot.chat("🔄 Skin reset to default");
    }
    console.log("[SkinManager] Skin reset to default");
  }

  /**
   * Get current skin info
   */
  getCurrentSkinInfo() {
    return skinManager.getCurrentSkin();
  }

  /**
   * List all available skins
   */
  listSkins() {
    const available = skinManager.getAvailableSkins();
    return {
      available,
      current: skinManager.getCurrentSkinName(),
      count: available.length,
    };
  }
}

module.exports = new SkinCommandHandler();
