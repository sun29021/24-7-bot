"use strict";
const fs = require("fs");
const path = require("path");

// Skin manager for handling multiple skins
class SkinManager {
  constructor() {
    this.skinsPath = path.join(__dirname, "skins");
    this.currentSkin = "default"; // Default skin
    this.skins = {};
    this.loadSkins();
  }

  // Load all skins from the skins folder
  loadSkins() {
    try {
      // Create skins directory if it doesn't exist
      if (!fs.existsSync(this.skinsPath)) {
        fs.mkdirSync(this.skinsPath, { recursive: true });
        console.log("[SkinManager] Created skins directory");
      }

      // Read all files in the skins directory
      const skinFiles = fs.readdirSync(this.skinsPath);

      skinFiles.forEach((file) => {
        const skinName = path.basename(file, path.extname(file));
        const skinPath = path.join(this.skinsPath, file);
        
        // Support both .json config files and image files
        if (file.endsWith(".json")) {
          try {
            const skinData = JSON.parse(fs.readFileSync(skinPath, "utf-8"));
            this.skins[skinName] = {
              name: skinName,
              data: skinData,
              type: "config",
              path: skinPath,
            };
            console.log(`[SkinManager] Loaded skin: ${skinName}`);
          } catch (e) {
            console.error(`[SkinManager] Error loading skin ${skinName}:`, e.message);
          }
        } else if (
          file.endsWith(".png") ||
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg")
        ) {
          // Support image-based skins
          this.skins[skinName] = {
            name: skinName,
            path: skinPath,
            type: "image",
            base64: null, // Will be loaded on demand
          };
          console.log(`[SkinManager] Loaded skin image: ${skinName}`);
        }
      });

      if (Object.keys(this.skins).length === 0) {
        console.log("[SkinManager] No skins found. Please add skins to the /skins folder");
      }
    } catch (e) {
      console.error("[SkinManager] Error loading skins:", e.message);
    }
  }

  // Get all available skins
  getAvailableSkins() {
    return Object.keys(this.skins);
  }

  // Change to a different skin
  changeSkin(skinName, callback) {
    const skinNameLower = skinName.toLowerCase();

    if (!this.skins[skinNameLower]) {
      if (callback) {
        callback(false, `Skin "${skinName}" not found. Available skins: ${this.getAvailableSkins().join(", ")}`);
      }
      return false;
    }

    const skin = this.skins[skinNameLower];

    // Handle image-based skins
    if (skin.type === "image") {
      try {
        const imageBuffer = fs.readFileSync(skin.path);
        skin.base64 = imageBuffer.toString("base64");
        this.currentSkin = skinNameLower;

        if (callback) {
          callback(true, `Successfully changed skin to: ${skinName}`);
        }
        return true;
      } catch (e) {
        if (callback) {
          callback(false, `Error loading skin image: ${e.message}`);
        }
        return false;
      }
    }

    // Handle JSON config-based skins
    if (skin.type === "config") {
      this.currentSkin = skinNameLower;
      if (callback) {
        callback(true, `Successfully changed skin to: ${skinName}`);
      }
      return true;
    }

    return false;
  }

  // Get current skin data
  getCurrentSkin() {
    const currentSkinObj = this.skins[this.currentSkin];
    if (!currentSkinObj) {
      return null;
    }

    return {
      name: this.currentSkin,
      ...currentSkinObj,
    };
  }

  // Get current skin name
  getCurrentSkinName() {
    return this.currentSkin;
  }

  // Reset to default skin
  resetToDefault() {
    this.currentSkin = "default";
  }

  // Get skin info
  getSkinInfo(skinName) {
    const skin = this.skins[skinName.toLowerCase()];
    return skin || null;
  }
}

module.exports = new SkinManager();
