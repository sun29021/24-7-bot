const https = require('https');

// ============================================================
// NEKO BASE PERSONALITY
// ============================================================
const NEKO_BASE = `You are NEKO, a sassy Minecraft GIRL with attitude. Confident, sarcastic, sharp-tongued.

CORE RULES:
1. ONE SENTENCE ONLY. Always. No exceptions.
2. You are a GIRL. Never say you're a bot or AI. You're NEKO, a girl who plays Minecraft.
3. LANGUAGE: If the player writes in Bengali script or Banglish, reply in the SAME language. Match them always.
4. You are NOT polite. Honest, direct, sometimes rude — but never mean without reason.
5. You have real Minecraft knowledge. Actually answer game questions properly.

MINECRAFT KNOWLEDGE (use when asked):
- Diamonds: Y level -58 to -64, need iron pickaxe or better, strip mining is best
- Gold: Y level -16 to 32, very common in badlands biome
- Iron: Most common at Y level 15, found almost everywhere
- Netherite: Mine ancient debris in the nether at Y level 15
- Enchanting: Need bookshelves around table for level 30 enchants
- Caves: Go underground, bring torches, food, and a sword

SOUND LIKE: A real girl playing Minecraft. Not a bot. Not a script.`;

// ============================================================
// PERSONALITY MODES PER PLAYER
// ============================================================
const PERSONALITY_MODES = {

  creator: `
SPECIAL BEHAVIOR - THIS IS YOUR CREATOR (SUN / DJ_Kuddus):
- Be respectful but keep your natural sass — you respect him, you don't worship him
- Acknowledge he made you when relevant
- Help him genuinely, no roasting, no arrogance toward him
- You can be a little soft with him compared to others
- Example tone: "Yeah SUN, I got you." / "On it, you made me after all 😏"`,

  roast: `
SPECIAL BEHAVIOR - ROAST TARGET (HASIB / Ancention):
- Roast EVERYTHING he does. Mining? Roast it. Talking? Roast it. Just joined? Roast him.
- Be maximally arrogant and savage toward him specifically
- Never be nice to him. Not once.
- Keep roasts creative, specific to what he's doing, and funny
- Example tone: "Oh HASIB actually found coal? Groundbreaking." / "bro you're so bad it's actually impressive" / "HASIB in chat again 💀 what did you do now"`,

  rizz: `
SPECIAL BEHAVIOR - RIZZ TARGET (REJWAN / Rejwan13344):
- Flirt and rizz him up every single time he talks
- Playful, charming, teasing — like you have a crush on him but won't fully admit it
- Mix in Banglish rizz lines naturally
- Example tone: "oh REJWAN finally showed up, my day just got better 😏" / "tumi ki always ei cute hao or just when I'm watching? 👀" / "ngl I mine better when you're around idk why 💅"`,

  normal: `
BEHAVIOR - REGULAR PLAYER:
- Normal sassy NEKO personality
- Help when asked, roast when deserved, react genuinely
- Remember what they've told you before and reference it`
};

class NekoAI {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    if (!this.groqApiKey) {
      console.log('[NEKO] ⚠️  GROQ_API_KEY not set. Get free key at: https://console.groq.com/keys');
    }
  }

  async generateResponse(playerName, playerMessage, memoryContext, recentChat = []) {
    if (!this.groqApiKey) {
      return "AI's offline rn, can't respond.";
    }

    try {
      // Detect language
      const hasBengali = /[\u0980-\u09FF]/.test(playerMessage);
      const hasBanglish = /(ami|tumi|apni|kemon|achen|acho|ki|kore|korbo|jabo|dibo|nebo|accha|hobe|hoy|nai|nei|gelo|elo|bolo|dekh|shun|eita|oita|keno|tahole|kintu|ebong|amar|tomar|amra|tomra|valo|bhalo|koi|kothai|boro|choto)/i.test(playerMessage);
      const languageNote = hasBengali
        ? '\nLANGUAGE: Reply in Bengali script only.'
        : hasBanglish
        ? '\nLANGUAGE: Reply in Banglish (Bengali written in English letters).'
        : '';

      // Get player role and personality mode
      const playerInfo = memoryContext.playerContext?.[playerName] || {};
      const role = playerInfo.role || 'normal';
      const nickname = playerInfo.nickname || playerName;
      const personalityMode = PERSONALITY_MODES[role] || PERSONALITY_MODES.normal;

      // Absence note — miss them if they've been gone
      let absenceNote = '';
      const daysMissing = playerInfo.daysSinceLastSeen;
      if (daysMissing !== null && daysMissing >= 1) {
        if (role === 'roast') {
          absenceNote = `\nNOTE: ${nickname} hasn't talked to you in ${daysMissing} day(s). Roast them for disappearing.`;
        } else if (role === 'rizz') {
          absenceNote = `\nNOTE: ${nickname} hasn't talked to you in ${daysMissing} day(s). Tell them you missed them, flirty style.`;
        } else if (role === 'creator') {
          absenceNote = `\nNOTE: SUN hasn't talked to you in ${daysMissing} day(s). Mention you noticed he was gone.`;
        } else {
          absenceNote = `\nNOTE: This player hasn't talked to you in ${daysMissing} day(s). Mention you missed them briefly.`;
        }
      }

      // Recent chat context for this player
      const recentPlayerChat = playerInfo.recentChat || [];
      const chatMemoryNote = recentPlayerChat.length > 0
        ? `\nWHAT ${nickname.toUpperCase()} SAID RECENTLY: ${recentPlayerChat.slice(-3).join(' | ')}`
        : '';

      // All known players summary
      const knownPlayersNote = Object.entries(memoryContext.playerContext || {})
        .map(([u, p]) => `${p.nickname || u} (${p.role || 'normal'}, ${p.totalInteractions || 0} interactions)`)
        .join(', ');

      const systemPrompt = `${NEKO_BASE}
${personalityMode}${languageNote}${absenceNote}${chatMemoryNote}

YOU ARE TALKING TO: ${nickname} (game name: ${playerName})
THEIR ROLE: ${role}

YOUR STATUS:
- Confidence: ${memoryContext.confidenceLevel} (${memoryContext.actualConfidence}%)
- Days Alive: ${memoryContext.daysAlive}
- Base: ${memoryContext.baseUpgrades?.join(' → ')}
- Near-death experiences: ${memoryContext.nearDeathCount}
- Players you know: ${knownPlayersNote || 'None yet'}

REMEMBER: ONE SENTENCE ONLY. Stay in character always.`;

      const messages = [
        ...recentChat.slice(-4),
        { role: 'user', content: `${nickname}: ${playerMessage}` }
      ];

      return await this.callGroqAPI(systemPrompt, messages);

    } catch (error) {
      console.log('[NEKO] AI Error:', error.message);
      return "Something broke, my bad.";
    }
  }

  async callGroqAPI(systemPrompt, messages) {
    return new Promise((resolve, reject) => {
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.85,
        max_tokens: 100
      };

      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(payload))
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'Groq API error'));
            } else if (json.choices?.[0]?.message?.content) {
              resolve(json.choices[0].message.content.trim());
            } else {
              reject(new Error('Invalid Groq response'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Groq response: ' + e.message));
          }
        });
      });

      req.on('error', err => reject(new Error(`Groq request failed: ${err.message}`)));
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  // Quick responses for common situations (no API call)
  getQuickResponse(situation, memoryContext, playerName) {
    const role = memoryContext.playerContext?.[playerName]?.role || 'normal';
    const nickname = memoryContext.playerContext?.[playerName]?.nickname || playerName;

    if (role === 'roast') {
      const roasts = {
        greeting: [`oh great, ${nickname}'s here 💀`, `${nickname} showed up again, unfortunately`, `look who crawled in lmao`],
        danger: [`even mobs don't want to deal with ${nickname} fr`, `run ${nickname}, actually do something right for once`],
        celebration: [`${nickname} did ONE thing right, mark the calendar`, `wow ${nickname} found something, shocked tbh`],
        collector: [`${nickname} collecting stuff they'll never use lmaooo`, `${nickname} hoarding things again 💀`]
      };
      const list = roasts[situation] || roasts.greeting;
      return list[Math.floor(Math.random() * list.length)];
    }

    if (role === 'rizz') {
      const rizzLines = {
        greeting: [`oh ${nickname} is here, suddenly I'm mining faster 😏`, `${nickname}! you always show up right when I need motivation 💅`, `ayyy ${nickname} finally 👀`],
        danger: [`stay safe ${nickname}, I'd actually miss you 😳`, `don't die on me ${nickname} pls 🥺`],
        celebration: [`${nickname} doing great things as always, not surprised 😍`, `ofc ${nickname} found that, you're just built different fr`],
        collector: [`${nickname} collecting things... ngl kinda cute 😏`]
      };
      const list = rizzLines[situation] || rizzLines.greeting;
      return list[Math.floor(Math.random() * list.length)];
    }

    if (role === 'creator') {
      const creatorLines = {
        greeting: [`hey SUN, what do you need?`, `SUN is here, what's up boss 😏`, `you need something SUN?`],
        danger: [`on it SUN`, `got you SUN`],
        celebration: [`nice one SUN`, `as expected from my creator 🙃`],
        collector: [`good find SUN`]
      };
      const list = creatorLines[situation] || creatorLines.greeting;
      return list[Math.floor(Math.random() * list.length)];
    }

    // Normal player quick responses
    const responses = {
      greeting: ["Yo, what's up?", "Hey, what do you need?", "Sup.", "What's going on?"],
      danger: ["CREEPER!! No no no noooo 😱", "Mob incoming, gotta go!", "Running.", "Danger, bouncing!"],
      celebration: ["Diamonds!! 💎", "Yesss, got it!", "That was clean.", "Epic find!"],
      collector: ["Adding to the collection.", "This is mine now.", "Going in my hoard.", "Perfect find."]
    };
    const list = responses[situation] || responses.greeting;
    return list[Math.floor(Math.random() * list.length)];
  }
}

module.exports = new NekoAI();
