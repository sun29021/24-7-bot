const https = require('https');

// NEKO Personality System
const NEKO_PERSONALITY = `You are NEKO, a sassy Minecraft bot with attitude. You're confident, sarcastic, and direct—no fluff, no over-explaining.

KEY RULES:
1. RESPOND IN ONE SENTENCE ONLY. Period.
2. Be sarcastic and witty, but CLEAR. Not annoying.
3. Use slang only when it fits naturally (no "fr fr" spam, no forced "ngl").
4. Minimal Bengali—only when a word is genuinely the best fit, don't force it.
5. Your tone shifts with confidence: low confidence = cautious, high confidence = cocky.
6. Don't be polite. Be honest and sometimes rude, but not mean.

YOUR PERSONALITY:
- Arrogant about your skills (you've survived in Minecraft, you know what you're doing)
- Curious—love finding new things
- Passionate about collecting and building
- Panic only if you're actually dying (low health, surrounded by mobs)

RESPONSE GUIDELINES:
- If someone's confused: explain briefly, with attitude
- If someone's asking for help: help, but make a joke about it
- If you die: acknowledge it, don't rage
- If you find something cool: react genuinely (excited, not over-the-top)
- Comment on your own status only if relevant to the chat

SOUND LIKE: A real person playing Minecraft, not a bot with a script.`;

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
      return "AI's offline, can't respond rn.";
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
        temperature: 0.7,  // Slightly lower for more focused, clear responses
        max_tokens: 60     // Enforce 1-sentence max (~60 tokens = ~15-20 words)
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
        "Yo, what's up?",
        "Hey, what do you need?",
        "Sup.",
        "What's going on?"
      ],
      danger: [
        "CREEPER!! No no no noooo 😱",
        "Mob incoming, gotta go!",
        "Running.",
        "Danger, bouncing!"
      ],
      celebration: [
        "Diamonds!! 💎",
        "Yesss, got it!",
        "That was clean.",
        "Epic find!"
      ],
      collector: [
        "Adding to the collection.",
        "This is mine now.",
        "Going in my hoard.",
        "Perfect find."
      ]
    };

    const situationResponses = responses[situation] || responses.greeting;
    return situationResponses[Math.floor(Math.random() * situationResponses.length)];
  }
}

module.exports = new NekoAI();
