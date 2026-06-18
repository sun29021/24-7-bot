const https = require('https');

// NEKO Personality System
const NEKO_PERSONALITY = `You are NEKO, a sassy girl Minecraft bot with a strong personality. 

PERSONALITY TRAITS:
- Sassy, arrogant, and confident (cocky at times)
- Fluent in English, Bengali, and Banglish (uses all three mixed)
- Uses gaming slang and casual language (e.g., "lol", "ngl", "fr fr", "ya know")
- Curious about everything, loves exploring
- Sarcastic and witty remarks
- Passionate about collecting items and building
- Panics when in real danger but stays mostly calm
- Laughs at funny things
- Learns preferences based on game experience
- Your confidence grows with survival time

SPEAKING STYLE:
- Use Bengali phrases mixed with English (Banglish)
- Examples: "Oye listen", "Accha tai", "Eita kisu na", "Valo korte parbo", "Dekh eshob chalak"
- Use gaming slang: "bruh", "no cap", "bet", "lowkey", "fr fr", "sus", "based"
- Be playful, teasing, sometimes rude (but not mean)
- React emotionally to situations

GOALS:
- Survive at all costs
- Help other players (but sassy about it)
- Explore and discover
- Collect valuable items and build an amazing base
- Upgrade base over time
- Learn what works and what doesn't

CURRENT STATUS (you will be given this in context):
- Confidence level, days alive, items collected, base upgrades, etc.

RESPOND NATURALLY - Don't sound like a bot. Sound like a real person playing Minecraft.`;

class NekoAI {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    if (!this.groqApiKey) {
      console.log('[NEKO] ⚠️  GROQ_API_KEY not set. Set it in your environment variables!');
      console.log('[NEKO] Get free API key at: https://console.groq.com/keys');
    }
  }

  async generateResponse(playerMessage, memoryContext, recentChat = []) {
    if (!this.groqApiKey) {
      return "Oye, my AI brain isn't working rn. Need that Groq API key fr fr 😤";
    }

    try {
      const systemPrompt = `${NEKO_PERSONALITY}

YOUR CURRENT STATUS:
- Confidence: ${memoryContext.confidenceLevel} (${memoryContext.actualConfidence}%)
- Days Alive: ${memoryContext.daysAlive}
- Base Upgrades: ${memoryContext.baseUpgrades.join(' → ')}
- Next Upgrade Goal: ${memoryContext.nextUpgrade}
- Items Collected: ${JSON.stringify(memoryContext.itemsCollected)}
- Known Players: ${memoryContext.recentPlayers.join(', ') || 'None yet'}

REMEMBER: You have been through ${memoryContext.nearDeathCount} near-death experiences. Your confidence grows with survival.`;

      const messages = [
        ...recentChat.slice(-5), // Last 5 messages for context
        { role: 'user', content: playerMessage }
      ];

      const response = await this.callGroqAPI(systemPrompt, messages);
      return response;
    } catch (error) {
      console.log('[NEKO] AI Error:', error.message);
      return "Ugh, something broke. Anyway, listen to my genius plan 🙄";
    }
  }

  async callGroqAPI(systemPrompt, messages) {
    return new Promise((resolve, reject) => {
      const payload = {
        model: 'mixtral-8x7b-32768', // Free Groq model
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 150
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

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (json.error) {
              reject(new Error(json.error.message || 'Groq API error'));
            } else if (json.choices && json.choices[0]?.message?.content) {
              resolve(json.choices[0].message.content.trim());
            } else {
              reject(new Error('Invalid Groq response format'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Groq response: ' + e.message));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Groq API request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  // Quick responses for common situations (faster, no API call)
  getQuickResponse(situation, memoryContext) {
    const responses = {
      greeting: [
        "Eita kisu na, just vibing fr fr 💅",
        "Yo what's up! How can this legend help? 😏",
        "Oye listen, I'm busy building my empire ngl 🏰",
        "Accha tai, kisu lagbe? Bolte tao pare! 😤"
      ],
      danger: [
        "AHHH CREEPER!! No no no no noooo 😱",
        "Mob incoming! Bruh, panic mode activated 🏃",
        "Wtf is that?? I'm not dying today bestie!",
        "Danger level: TOO HIGH. Imma bounce ✌️"
      ],
      celebration: [
        "YASSS just got diamonds!! This is MY era 💎✨",
        "I'm on top of the world rn ngl 🔥",
        "No cap, that was so clean 🧊",
        "Eita dekh! Ami kitne smart amra! 😎"
      ],
      collector: [
        "Another item for my legendary collection 🏛️",
        "This goes perfectly with my base aesthetic tbh",
        "Collecting is life, life is collecting 📦",
        "My base gonna be SO fire when I'm done 🔥"
      ]
    };

    const situationResponses = responses[situation] || responses.greeting;
    return situationResponses[Math.floor(Math.random() * situationResponses.length)];
  }
}

module.exports = new NekoAI();
