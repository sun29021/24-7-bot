"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");
const https = require("https");
const nekoChatHandler = require('./nekoChatHandler');
const memory = require('./memory');
const nekoBehavior = require('./nekoBehavior');

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
};

// Health check endpoint for monitoring
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px;
          }

          main { width: 100%; max-width: 400px; }

          header { margin-bottom: 28px; }
          header h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          header p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
            line-height: 1.5;
          }

          .status-section {
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: background 0.3s, border-color 0.3s;
          }
          .status-section.online  { background: #0d2218; border: 2px solid #238636; }
          .status-section.offline { background: #200d0d; border: 2px solid #da3633; }

          .status-icon {
            width: 44px; height: 44px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
            transition: background 0.3s;
          }
          .status-icon.online  { background: #238636; }
          .status-icon.offline { background: #da3633; }

          .status-label { font-size: 18px; font-weight: 700; line-height: 1.2; transition: color 0.3s; }
          .status-label.online  { color: #3fb950; }
          .status-label.offline { color: #f85149; }
          .status-detail { font-size: 13px; color: #8b949e; margin-top: 3px; }

          dl { margin: 0; }
          .stat-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 10px;
          }
          dt { font-size: 12px; color: #8b949e; font-weight: 600; margin-bottom: 4px; }
          dd { margin: 0; font-size: 17px; font-weight: 600; color: #e6edf3; line-height: 1.3; }
          .stat-detail { margin: 4px 0 0; font-size: 11px; color: #6e7681; }

          .controls { margin-top: 8px; }
          .btn-grid { display: grid; gap: 10px; margin-bottom: 10px; }
          .btn-grid-2 { grid-template-columns: 1fr 1fr; }

          .btn-primary {
            min-height: 52px; border-radius: 10px;
            font-size: 15px; font-weight: 700;
            cursor: pointer; letter-spacing: 0.3px;
            transition: opacity 0.2s, filter 0.2s;
            font-family: inherit;
          }
          .btn-primary:hover  { filter: brightness(1.1); }
          .btn-primary:active { opacity: 0.85; }
          .btn-start { border: 2px solid #238636; background: #0d2218; color: #3fb950; }
          .btn-stop  { border: 2px solid #da3633; background: #200d0d; color: #f85149; }

          .btn-secondary {
            min-height: 44px; border-radius: 10px;
            border: 1px solid #21262d; background: #161b22; color: #8b949e;
            font-size: 13px; font-weight: 500;
            text-decoration: none;
            display: flex; align-items: center; justify-content: center;
            font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s;
          }
          .btn-secondary:hover { background: #21262d; color: #c9d1d9; }

          footer { margin-top: 20px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main role="main" aria-label="AFK Bot Dashboard">

          <header>
            <h1>AFK Bot Dashboard</h1>
            <p>Minecraft server bot &middot; Live status</p>
          </header>

          <section
            id="status-section"
            role="status"
            aria-live="polite"
            aria-label="Bot connection status"
            class="status-section offline"
          >
            <div id="status-icon" aria-hidden="true" class="status-icon offline">&#x2717;</div>
            <div>
              <div id="status-label" class="status-label offline">Connecting…</div>
              <div id="status-detail" class="status-detail">Establishing connection</div>
            </div>
          </section>

          <section aria-label="Bot statistics">
            <dl>
              <div class="stat-card">
                <dt>Uptime</dt>
                <dd id="uptime-text">—</dd>
                <p class="stat-detail">Time since last connection</p>
              </div>
              <div class="stat-card">
                <dt>Coordinates</dt>
                <dd id="coords-text">Searching…</dd>
                <p class="stat-detail">Bot's current in-game position</p>
              </div>
              <div class="stat-card">
                <dt>Server address</dt>
                <dd>${config.server.ip}</dd>
                <p class="stat-detail">Minecraft server hostname</p>
              </div>
            </dl>
          </section>

          <section class="controls" aria-label="Bot controls">
            <div class="btn-grid btn-grid-2">
              <button class="btn-primary btn-start" onclick="startBot()" aria-label="Start bot">Start bot</button>
              <button class="btn-primary btn-stop" onclick="stopBot()" aria-label="Stop bot">Stop bot</button>
            </div>
            <div class="btn-grid btn-grid-2">
              <a href="/tutorial" class="btn-secondary" aria-label="View setup guide">Setup guide</a>
              <a href="/logs" class="btn-secondary" aria-label="View bot logs">View logs</a>
            </div>
          </section>

          <footer>
            <p>Status updates every 5 seconds</p>
          </footer>

        </main>

        <script>
          function formatUptime(s) {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
            if (m > 0) return m + 'm ' + sec + 's';
            return sec + ' seconds';
          }

          async function update() {
            try {
              const r = await fetch('/health');
              const data = await r.json();
              const online = data.status === 'connected';

              const section = document.getElementById('status-section');
              const icon    = document.getElementById('status-icon');
              const label   = document.getElementById('status-label');
              const detail  = document.getElementById('status-detail');

              section.className = 'status-section ' + (online ? 'online' : 'offline');
              icon.className    = 'status-icon '    + (online ? 'online' : 'offline');
              icon.textContent  = online ? '✓' : '✗';
              label.className   = 'status-label '   + (online ? 'online' : 'offline');
              label.textContent = online ? 'Connected' : 'Disconnected';
              detail.textContent = online ? 'Bot is active on the server' : 'Attempting to reconnect';

              document.getElementById('uptime-text').textContent = formatUptime(data.uptime);

              if (data.coords) {
                const x = Math.floor(data.coords.x);
                const y = Math.floor(data.coords.y);
                const z = Math.floor(data.coords.z);
                document.getElementById('coords-text').textContent = 'X ' + x + ', Y ' + y + ', Z ' + z;
              } else {
                document.getElementById('coords-text').textContent = 'Searching…';
              }
            } catch (e) {
              const label = document.getElementById('status-label');
              label.className = 'status-label offline';
              label.textContent = 'Unreachable';
            }
          }

          async function startBot() {
            const r = await fetch('/start', { method: 'POST' });
            const data = await r.json();
            alert(data.success ? 'Bot started!' : data.msg);
            update();
          }

          async function stopBot() {
            const r = await fetch('/stop', { method: 'POST' });
            const data = await r.json();
            alert(data.success ? 'Bot stopped!' : data.msg);
            update();
          }

          setInterval(update, 5000);
          update();
        </script>
      </body>
    </html>
  `);
});
app.get("/tutorial", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Setup Guide</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 560px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          header { margin-bottom: 32px; }
          header h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          header p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
            line-height: 1.5;
          }

          .step-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 16px;
          }

          .step-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 18px;
          }

          .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #0d2218;
            border: 2px solid #238636;
            color: #3fb950;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .step-title {
            font-size: 16px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
          }

          ol {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          li {
            font-size: 14px;
            color: #8b949e;
            line-height: 1.6;
            padding-left: 20px;
            position: relative;
          }

          li::before {
            content: "·";
            position: absolute;
            left: 6px;
            color: #3fb950;
            font-weight: 700;
          }

          li strong { color: #e6edf3; font-weight: 600; }

          code {
            background: #21262d;
            border: 1px solid #30363d;
            padding: 2px 7px;
            border-radius: 5px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 12px;
            color: #e6edf3;
          }

          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }

          footer {
            margin-top: 32px;
            text-align: center;
          }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <header>
            <h1>Setup Guide</h1>
            <p>Get your AFK bot running in under 15 minutes</p>
          </header>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">1</div>
              <h2 class="step-title">Configure Aternos</h2>
            </div>
            <ol>
              <li>Go to <strong>Aternos</strong> and open your server.</li>
              <li>Install <strong>Paper/Bukkit</strong> as your server software.</li>
              <li>Enable <strong>Cracked</strong> mode using the green switch.</li>
              <li>Install these plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code></li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">2</div>
              <h2 class="step-title">GitHub Setup</h2>
            </div>
            <ol>
              <li>Download this project as a ZIP and extract it.</li>
              <li>Edit <code>settings.json</code> with your server IP and port.</li>
              <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <h2 class="step-title">Deploy on Replit (Free 24/7)</h2>
            </div>
            <ol>
              <li>Import your GitHub repo into <strong>Replit</strong>.</li>
              <li>Set the run command to <code>npm start</code>.</li>
              <li>Hit <strong>Run</strong> — the bot connects automatically.</li>
              <li>The bot pings itself every 10 minutes to stay alive.</li>
            </ol>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();

  const escapeHTML = (str) =>
    str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );

  const logCount = logs.length;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 760px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          .page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 12px;
            flex-wrap: wrap;
          }

          .page-header-left h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          .page-header-left p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
          }

          .badge {
            font-size: 12px;
            font-weight: 600;
            color: #8b949e;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 20px;
            padding: 4px 12px;
            white-space: nowrap;
          }

          .log-card {
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 12px;
            overflow: hidden;
          }

          .log-card-header {
            background: #161b22;
            border-bottom: 1px solid #21262d;
            padding: 12px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red   { background: #ff5f57; }
          .dot-yellow{ background: #ffbd2e; }
          .dot-green { background: #28c840; }

          .log-card-title {
            font-size: 12px;
            font-weight: 500;
            color: #484f58;
            margin-left: 4px;
          }

          .log-body {
            padding: 16px 18px;
            max-height: 560px;
            overflow-y: auto;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            line-height: 1.7;
          }

          .log-entry { display: block; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
          .log-entry.error   { color: #ff7b72; }
          .log-entry.warn    { color: #e3b341; }
          .log-entry.success { color: #3fb950; }
          .log-entry.control { color: #58a6ff; }
          .log-entry.default { color: #8b949e; }

          .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #484f58;
            font-size: 13px;
          }

          .refresh-bar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            margin-top: 12px;
            font-size: 12px;
            color: #484f58;
          }
          .refresh-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #3fb950;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          .console-row {
            display: flex;
            align-items: center;
            border-top: 1px solid #21262d;
            background: #0d1117;
            padding: 10px 18px;
            gap: 10px;
          }

          .console-prompt {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            color: #3fb950;
            font-weight: 700;
            flex-shrink: 0;
            user-select: none;
          }

          .console-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            color: #e6edf3;
            caret-color: #3fb950;
          }

          .console-input::placeholder { color: #484f58; }

          .console-send {
            background: #0d2218;
            border: 1px solid #238636;
            color: #3fb950;
            font-size: 12px;
            font-weight: 600;
            padding: 5px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.2s;
            flex-shrink: 0;
          }
          .console-send:hover { background: #122d1a; }
          .console-send:disabled { opacity: 0.5; cursor: default; }

          .console-wrap {
            position: relative;
          }

          .cmd-suggestions {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0; right: 0;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 10;
          }

          .cmd-suggestions.visible { display: block; }

          .cmd-item {
            display: flex;
            align-items: baseline;
            gap: 12px;
            padding: 9px 16px;
            cursor: pointer;
            transition: background 0.12s;
            border-bottom: 1px solid #21262d;
          }
          .cmd-item:last-child { border-bottom: none; }
          .cmd-item:hover, .cmd-item.active {
            background: #21262d;
          }

          .cmd-name {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            font-weight: 700;
            color: #3fb950;
            flex-shrink: 0;
            min-width: 90px;
          }

          .cmd-desc {
            font-size: 12px;
            color: #6e7681;
          }

          footer { margin-top: 32px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <div class="page-header">
            <div class="page-header-left">
              <h1>Bot Logs</h1>
              <p>Live output from the AFK bot</p>
            </div>
            <span class="badge">${logCount} ${logCount === 1 ? "entry" : "entries"}</span>
          </div>

          <div class="log-card">
            <div class="log-card-header">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
              <span class="log-card-title">bot.log</span>
            </div>
            <div class="log-body" id="log-body">
              ${logCount === 0
                ? `<div class="empty-state">No log entries yet. Start the bot to see output.</div>`
                : logs.map((l) => {
                    const escaped = escapeHTML(l);
                    const lower = l.toLowerCase();
                    let cls = "default";
                    if (lower.includes("error") || lower.includes("fail")) cls = "error";
                    else if (lower.includes("warn")) cls = "warn";
                    else if (lower.includes("[control]")) cls = "control";
                    else if (lower.includes("connect") || lower.includes("join") || lower.includes("spawn")) cls = "success";
                    return `<span class="log-entry ${cls}">${escaped}</span>`;
                  }).join("")
              }
            </div>
            <div class="console-wrap">
              <div class="cmd-suggestions" id="cmd-suggestions"></div>
              <div class="console-row">
                <span class="console-prompt">&gt;</span>
                <input
                  id="console-input"
                  class="console-input"
                  type="text"
                  placeholder="Type / for commands, or any message…"
                  autocomplete="off"
                  spellcheck="false"
                >
                <button id="console-send" class="console-send">Send</button>
              </div>
            </div>
          </div>

          <div class="refresh-bar">
            <span class="refresh-dot"></span>
            <span id="refresh-label">Auto-refreshing every 5 seconds</span>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>

        <script>
          (function() {
            var logBody  = document.getElementById('log-body');
            var input    = document.getElementById('console-input');
            var sendBtn  = document.getElementById('console-send');
            var label    = document.getElementById('refresh-label');
            var sugBox   = document.getElementById('cmd-suggestions');
            var refreshTimer = null;
            var typing = false;
            var activeIdx = -1;

            var COMMANDS = [
              { name: '/help',   desc: 'Show all available commands' },
              { name: '/pos',    desc: "Show bot's current coordinates" },
              { name: '/status', desc: 'Show connection status & uptime' },
              { name: '/list',   desc: 'List players on the server' },
              { name: '/say',    desc: 'Send a chat message in-game' },
            ];

            function scrollBottom() {
              if (logBody) logBody.scrollTop = logBody.scrollHeight;
            }

            function scheduleRefresh() {
              clearTimeout(refreshTimer);
              if (!typing) {
                refreshTimer = setTimeout(function() { location.reload(); }, 5000);
              }
            }

            function appendLocalEntry(text, cls) {
              var span = document.createElement('span');
              span.className = 'log-entry ' + (cls || 'control');
              span.textContent = text;
              logBody.appendChild(span);
              scrollBottom();
            }

            function hideSuggestions() {
              sugBox.classList.remove('visible');
              sugBox.innerHTML = '';
              activeIdx = -1;
            }

            function setActive(idx) {
              var items = sugBox.querySelectorAll('.cmd-item');
              items.forEach(function(el, i) {
                el.classList.toggle('active', i === idx);
              });
              activeIdx = idx;
            }

            function showSuggestions(val) {
              var query = val.toLowerCase();
              var matches = COMMANDS.filter(function(c) {
                return c.name.startsWith(query);
              });

              if (!matches.length) { hideSuggestions(); return; }

              sugBox.innerHTML = matches.map(function(c, i) {
                return '<div class="cmd-item" data-cmd="' + c.name + '">' +
                  '<span class="cmd-name">' + c.name + '</span>' +
                  '<span class="cmd-desc">' + c.desc + '</span>' +
                '</div>';
              }).join('');

              sugBox.querySelectorAll('.cmd-item').forEach(function(el) {
                el.addEventListener('mousedown', function(e) {
                  e.preventDefault();
                  input.value = el.dataset.cmd + ' ';
                  hideSuggestions();
                  input.focus();
                });
              });

              activeIdx = -1;
              sugBox.classList.add('visible');
            }

            input.addEventListener('input', function() {
              var val = input.value;
              if (val.startsWith('/')) {
                showSuggestions(val);
              } else {
                hideSuggestions();
              }
            });

            input.addEventListener('keydown', function(e) {
              var items = sugBox.querySelectorAll('.cmd-item');
              if (sugBox.classList.contains('visible') && items.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive(Math.min(activeIdx + 1, items.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive(Math.max(activeIdx - 1, 0));
                  return;
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && activeIdx >= 0)) {
                  e.preventDefault();
                  var chosen = items[activeIdx >= 0 ? activeIdx : 0];
                  input.value = chosen.dataset.cmd + ' ';
                  hideSuggestions();
                  return;
                }
                if (e.key === 'Escape') {
                  hideSuggestions();
                  return;
                }
              }
              if (e.key === 'Enter') sendCommand();
            });

            function sendCommand() {
              var cmd = input.value.trim();
              if (!cmd) return;
              hideSuggestions();
              input.value = '';
              sendBtn.disabled = true;
              appendLocalEntry('> ' + cmd, 'control');

              fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
              })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.msg) {
                  data.msg.split('\\n').forEach(function(line) {
                    appendLocalEntry(line, data.success ? 'default' : 'error');
                  });
                }
              })
              .catch(function() {
                appendLocalEntry('Failed to send command.', 'error');
              })
              .finally(function() {
                sendBtn.disabled = false;
                input.focus();
                scheduleRefresh();
              });
            }

            sendBtn.addEventListener('click', sendCommand);

            input.addEventListener('focus', function() {
              typing = true;
              clearTimeout(refreshTimer);
              label.textContent = 'Auto-refresh paused while typing';
            });
            input.addEventListener('blur', function() {
              setTimeout(function() {
                hideSuggestions();
                typing = false;
                label.textContent = 'Auto-refreshing every 5 seconds';
                scheduleRefresh();
              }, 150);
            });

            scrollBottom();
            scheduleRefresh();
          })();
        </script>
      </body>
    </html>
  `);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });

  botRunning = true;
  createBot();
  addLog("[Control] Bot started");

  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });

  botRunning = false;

  if (bot) {
    bot.end();
    bot = null;
  }

  clearAllIntervals();
  addLog("[Control] Bot stopped");

  res.json({ success: true });
});

app.post("/command", express.json(), (req, res) => {
  const cmd = (req.body.command || "").trim();
  if (!cmd) return res.json({ success: false, msg: "Empty command." });

  addLog(`[Console] > ${cmd}`);

  if (cmd === "/help") {
    const lines = [
      "Available commands:",
      "  /help          - Show this help message",
      "  /pos           - Show bot's current coordinates",
      "  /status        - Show bot connection status",
      "  /list          - Ask server for player list",
      "  /say <message> - Send a chat message in-game",
      "  /<anything>    - Send any Minecraft command directly",
      "  <text>         - Send plain chat (no slash needed)",
    ];
    lines.forEach((l) => addLog(`[Console] ${l}`));
    return res.json({ success: true, msg: lines.join("\n") });
  }

  if (cmd === "/pos" || cmd === "/coords") {
    const pos = bot && bot.entity ? bot.entity.position : null;
    const msg = pos
      ? `Position: X=${Math.floor(pos.x)}  Y=${Math.floor(pos.y)}  Z=${Math.floor(pos.z)}`
      : "Position unavailable (bot not spawned).";
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (cmd === "/status") {
    const status = botState.connected ? "Connected" : "Disconnected";
    const uptime = Math.floor((Date.now() - botState.startTime) / 1000);
    const msg = `Status: ${status} | Uptime: ${uptime}s | Reconnects: ${botState.reconnectAttempts}`;
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (!bot || typeof bot.chat !== "function") {
    const msg = bot
      ? "Bot is still connecting — try again in a moment."
      : "Bot is not running.";
    addLog(`[Console] ${msg}`);
    return res.json({ success: false, msg });
  }

  try {
    bot.chat(cmd);
    addLog(`[Console] Sent to server: ${cmd}`);
    return res.json({ success: true, msg: `Sent: ${cmd}` });
  } catch (err) {
    addLog(`[Console] Error: ${err.message}`);
    return res.json({ success: false, msg: err.message });
  }
});

// ============================================================
//                    END OF WEB TOOLS
//============================================================

// FIX: handle port conflict gracefully - try next port if taken
const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] HTTP server started on port ${server.address().port} `);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallbackPort = PORT + 1;
    addLog(`[Server] Port ${PORT} in use - trying port ${fallbackPort} `);
    server.listen(fallbackPort, "0.0.0.0");
  } else {
    addLog(`[Server] HTTP server error: ${err.message} `);
  }
});

// FIX: only one definition of formatUptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s} s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// FIX: only ping if RENDER_EXTERNAL_URL is set (skip useless localhost ping)
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000;

function startSelfPing() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!renderUrl) {
    addLog(
      "[KeepAlive] No RENDER_EXTERNAL_URL set - self-ping disabled (running locally)",
    );
    return;
  }
  setInterval(() => {
    const protocol = renderUrl.startsWith("https") ? https : http;
    protocol
      .get(`${renderUrl}/ping`, (res) => {
        // Silent success
      })
      .on("error", (err) => {
        addLog(`[KeepAlive] Self-ping failed: ${err.message}`);
      });
  }, SELF_PING_INTERVAL);
  addLog("[KeepAlive] Self-ping system started (every 10 min)");
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(
  () => {
    const mem = process.memoryUsage();
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
    addLog(`[Memory] Heap: ${heapMB} MB`);
  },
  5 * 60 * 1000,
);

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
// ============================================================
// RECONNECTION & TIMEOUT MANAGEMENT
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeoutId = null;
let connectionTimeoutId = null;
let isReconnecting = false;

function clearBotTimeouts() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

// FIX: Discord rate limiting - track last send time
let lastDiscordSend = 0;
const DISCORD_RATE_LIMIT_MS = 5000; // min 5s between webhook calls

function clearAllIntervals() {
  addLog(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach((id) => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  if (botState.wasThrottled) {
    botState.wasThrottled = false;
    const throttleDelay = 60000 + Math.floor(Math.random() * 60000);
    addLog(
      `[Bot] Throttle detected - using extended delay: ${throttleDelay / 1000}s`,
    );
    return throttleDelay;
  }

  // FIX: read auto-reconnect-delay from settings as base delay
  const baseDelay = config.utils["auto-reconnect-delay"] || 3000;
  const maxDelay = config.utils["max-reconnect-delay"] || 30000;
  const delay = Math.min(
    baseDelay * Math.pow(2, botState.reconnectAttempts),
    maxDelay,
  );
  const jitter = Math.floor(Math.random() * 2000);
  return delay + jitter;
}

function createBot() {
  if (isReconnecting) {
    addLog("[Bot] Already reconnecting, skipping...");
    return;
  }

  // Cleanup previous bot properly to avoid ghost bots
  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      addLog("[Cleanup] Error ending previous bot:", e.message);
    }
    bot = null;
  }

  addLog(`[Bot] Creating bot instance...`);
  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    // FIX: use version:false to auto-detect server version so the bot can join any server.
    // If the user explicitly sets a version in settings.json it is still respected.
    const botVersion =
      config.server.version && config.server.version.trim() !== ""
        ? config.server.version
        : false;
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: botVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });

    bot.loadPlugin(pathfinder);

    // FIX: connection timeout - end the old bot before reconnecting to avoid ghost bots
    clearBotTimeouts();
    connectionTimeoutId = setTimeout(() => {
      if (!botState.connected) {
        addLog("[Bot] Connection timeout - no spawn received");
        try {
          bot.removeAllListeners();
          bot.end();
        } catch (e) {
          /* ignore */
        }
        bot = null;
        scheduleReconnect();
      }
    }, 150000); // 150s - Aternos servers can take 90-120s to finish spawning a player

    // FIX: guard against spawn firing twice (can happen on some servers)
    let spawnHandled = false;

    bot.once("spawn", () => {
      if (spawnHandled) return;
      spawnHandled = true;

      // ADD THESE TWO LINES AT THE TOP:
      memory.data.daysAlive++;
      memory.saveMemory();

      clearBotTimeouts();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      addLog(
        `[Bot] [+] Successfully spawned on server! (Version: ${bot.version})`,
      );
      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.connect
      ) {
        sendDiscordWebhook(
          `[+] **Connected** to \`${config.server.ip}\``,
          0x4ade80,
        );
      }

      // NEKO says hello
      setTimeout(() => {
        bot.chat('NEKO online! Let the adventure begin! 💅');
      }, 1000);

      // FIX: use bot.version (auto-detected) instead of config value so minecraft-data always matches
      const mcData = require("minecraft-data")(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      initializeModules(bot, mcData, defaultMove);

      // Attempt creative mode (only works if bot has OP and enabled in settings)
      setTimeout(() => {
        if (bot && botState.connected && config.server["try-creative"]) {
          bot.chat("/gamemode creative");
          addLog("[INFO] Attempted to set creative mode (requires OP)");
        }
      }, 3000);

      bot.on("messagestr", (message) => {
        if (
          message.includes("commands.gamemode.success.self") ||
          message.includes("Set own game mode to Creative Mode")
        ) {
          addLog("[INFO] Bot is now in Creative Mode.");
        }
      });
    });

    // NEKO's main chat handler using nekoChatHandler module
    bot.on('chat', async (username, message) => {
      // Ignore NEKO's own messages (use bot.username instead of config.name to handle server-assigned casing)
      if (username === bot.username) return;
      
      try {
        // Get NEKO's response
        const response = await nekoChatHandler.handlePlayerChat(username, message, bot);
        
        // Send after a small delay (more human-like)
        setTimeout(() => {
          bot.chat(response);
        }, Math.random() * 500 + 300);
        
      } catch (error) {
        console.log('[NEKO] Chat error:', error.message);
      }
      
      // Keep chat logging
      addLog(`${username}: ${message}`);
    });

    // FIX: 'kicked' fires before 'end'. Remove the scheduleReconnect from 'kicked'
    // so that 'end' is the single source of reconnect truth, preventing double-trigger.
    bot.on("kicked", (reason) => {
      // FIX: stringify reason if it's an object to make it readable in logs
      const kickReason =
        typeof reason === "object" ? JSON.stringify(reason) : reason;
      addLog(`[Bot] Kicked: ${kickReason}`);
      botState.connected = false;
      botState.errors.push({
        type: "kicked",
        reason: kickReason,
        time: Date.now(),
      });
      clearAllIntervals();

      const reasonStr = String(kickReason).toLowerCase();
      if (
        reasonStr.includes("throttl") ||
        reasonStr.includes("wait before reconnect") ||
        reasonStr.includes("too fast")
      ) {
        addLog(
          "[Bot] Throttle kick detected - will use extended reconnect delay",
        );
        botState.wasThrottled = true;
      }

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(`[!] **Kicked**: ${kickReason}`, 0xff0000);
      }
      // NOTE: do NOT call scheduleReconnect() here - 'end' will fire right after 'kicked' and handle it
    });

    // FIX: 'end' is the single reconnect trigger
    bot.on("end", (reason) => {
      addLog(`[Bot] Disconnected: ${reason || "Unknown reason"}`);
      botState.connected = false;
      clearAllIntervals();
      spawnHandled = false; // reset for next connection

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(
          `[-] **Disconnected**: ${reason || "Unknown"}`,
          0xf87171,
        );
      }

      // ALWAYS reconnect — bot must never leave the server
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      const msg = err.message || "";
      addLog(`[Bot] Error: ${msg}`);
      botState.errors.push({ type: "error", message: msg, time: Date.now() });
      // Don't reconnect on error - let 'end' event handle it
    });

    // ============================================================
    // NEKO's health/danger tracker (MOVED INSIDE createBot to prevent undefined bot error)
    // ============================================================
    bot.on('health', () => {
      if (bot.health < 3) {
        if (memory && memory.recordNearDeath) {
          memory.recordNearDeath();
        }
        const messages = [
          "AHHHHH I'M DYING!! 😱",
          "NO NO NO NOT LIKE THIS!!",
          "HELP!! SOMEONE HELP ME!!"
        ];
        bot.chat(messages[Math.floor(Math.random() * messages.length)]);
      }
    });

    // ============================================================
    // NEKO's inventory tracker (MOVED INSIDE createBot to prevent undefined bot error)
    // ============================================================
    bot.on('inventory', (inventory) => {
      try {
        if (memory && memory.collectItem) {
          inventory.items().forEach(item => {
            memory.collectItem(item.name, item.count);
          });
        }
      } catch (e) {
        // ignore
      }
    });
  } catch (err) {
    addLog(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearBotTimeouts();

  // FIX: don't stack reconnect if already waiting
  if (isReconnecting) {
    addLog("[Bot] Reconnect already scheduled, skipping duplicate.");
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  addLog(
    `[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`,
  );

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  addLog("[Modules] Initializing all modules...");

  // ---------- AUTO AUTH (REACTIVE) ----------
  if (config.utils["auto-auth"] && config.utils["auto-auth"].enabled) {
    const password = config.utils["auto-auth"].password;
    let authHandled = false;

    const tryAuth = (type) => {
      if (authHandled || !bot || !botState.connected) return;
      authHandled = true;
      if (type === "register") {
        bot.chat(`/register ${password} ${password}`);
        addLog("[Auth] Detected register prompt - sent /register");
      } else {
        bot.chat(`/login ${password}`);
        addLog("[Auth] Detected login prompt - sent /login");
      }
    };

    bot.on("messagestr", (message) => {
      if (authHandled) return;
      const msg = message.toLowerCase();
      if (
        msg.includes("/register") ||
        msg.includes("register ") ||
        msg.includes("지정된 비밀번호")
      ) {
        tryAuth("register");
      } else if (
        msg.includes("/login") ||
        msg.includes("login ") ||
        msg.includes("로그인")
      ) {
        tryAuth("login");
      }
    });

    // Failsafe: if no prompt after 10s, try login anyway
    setTimeout(() => {
      if (!authHandled && bot && botState.connected) {
        addLog(
          "[Auth] No prompt detected after 10s, sending /login as failsafe",
        );
        bot.chat(`/login ${password}`);
        authHandled = true;
      }
    }, 10000);
  }

  // ---------- CHAT MESSAGES ----------
  if (config.utils["chat-messages"] && config.utils["chat-messages"].enabled) {
    const messages = config.utils["chat-messages"].messages;
    if (config.utils["chat-messages"].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils["chat-messages"]["repeat-delay"] * 1000);
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => {
          if (bot && botState.connected) bot.chat(msg);
        }, idx * 1000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  // FIX: only use position goal if circle-walk is NOT enabled (they fight over pathfinder)
  if (
    config.position &&
    config.position.enabled &&
    !(
      config.movement &&
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    )
  ) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(
      new GoalBlock(config.position.x, config.position.y, config.position.z),
    );
    addLog("[Position] Navigating to configured position...");
  }

  // ---------- ANTI-AFK ----------
  if (config.utils["anti-afk"] && config.utils["anti-afk"].enabled) {
    // Arm swinging
    addInterval(
      () => {
        if (!bot || !botState.connected) return;
        try {
          bot.swingArm();
        } catch (e) {}
      },
      10000 + Math.floor(Math.random() * 50000),
    );

    // Hotbar cycling
    addInterval(
      () => {
        if (!bot || !botState.connected) return;
        try {
          const slot = Math.floor(Math.random() * 9);
          bot.setQuickBarSlot(slot);
        } catch (e) {}
      },
      30000 + Math.floor(Math.random() * 90000),
    );

    // Teabagging
    addInterval(
      () => {
        if (
          !bot ||
          !botState.connected ||
          typeof bot.setControlState !== "function"
        )
          return;
        if (Math.random() > 0.9) {
          let count = 2 + Math.floor(Math.random() * 4);
          const doTeabag = () => {
            if (count <= 0 || !bot || typeof bot.setControlState !== "function")
              return;
            try {
              bot.setControlState("sneak", true);
              setTimeout(() => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("sneak", false);
                count--;
                setTimeout(doTeabag, 150);
              }, 150);
            } catch (e) {}
          };
          doTeabag();
        }
      },
      120000 + Math.floor(Math.random() * 180000),
    );

    // FIX: micro-walk only when circle-walk is NOT running, to avoid interrupting pathfinder
    if (
      !(
        config.movement &&
        config.movement["circle-walk"] &&
        config.movement["circle-walk"].enabled
      )
    ) {
      addInterval(
        () => {
          if (
            !bot ||
            !botState.connected ||
            typeof bot.setControlState !== "function"
          )
            return;
          try {
            const yaw = Math.random() * Math.PI * 2;
            bot.look(yaw, 0, true);
            bot.setControlState("forward", true);
            setTimeout(
              () => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("forward", false);
              },
              500 + Math.floor(Math.random() * 1500),
            );
            botState.lastActivity = Date.now();
          } catch (e) {
            addLog("[AntiAFK] Walk error:", e.message);
          }
        },
        120000 + Math.floor(Math.random() * 360000),
      );
    }

    if (config.utils["anti-afk"].sneak) {
      try {
        if (typeof bot.setControlState === "function")
          bot.setControlState("sneak", true);
      } catch (e) {}
    }
  }

  // ---------- MOVEMENT MODULES ----------
  // FIX: check top-level movement.enabled flag
  if (config.movement && config.movement.enabled !== false) {
    // FIX: circle-walk and random-jump both jump - only run one jumping mechanism
    // random-jump is skipped if anti-afk jump is handled elsewhere; we only use random-jump here
    if (
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    ) {
      startCircleWalk(bot, defaultMove);
    }
    // FIX: only run random-jump if circle-walk is NOT running (circle-walk also keeps bot moving)
    if (
      config.movement["random-jump"] &&
      config.movement["random-jump"].enabled &&
      !(
        config.movement["circle-walk"] && config.movement["circle-walk"].enabled
      )
    ) {
      startRandomJump(bot);
    }
    if (
      config.movement["look-around"] &&
      config.movement["look-around"].enabled
    ) {
      startLookAround(bot);
    }
  }

  // ---------- CUSTOM MODULES ----------
  // FIX: avoidMobs AND combatModule conflict - if combat is enabled, don't run avoidMobs at the same time
  if (config.modules.avoidMobs && !config.modules.combat) {
    avoidMobs(bot);
  }
  if (config.modules.combat) {
    combatModule(bot, mcData);
  }
  if (config.modules.beds) {
    bedModule(bot, mcData);
  }
  if (config.modules.chat) {
    chatModule(bot);
    roastModule(bot);
    deathMessageModule(bot);
    botDeathRageBaitModule(bot);
    achievementCongratsModule(bot);
    hasibRoastModule(bot);
    qaModule(bot);
  }

  addLog("[Modules] All modules initialized!");
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement["circle-walk"].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected) return;
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;
    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(
        new GoalBlock(
          Math.floor(x),
          Math.floor(bot.entity.position.y),
          Math.floor(z),
        ),
      );
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[CircleWalk] Error:", e.message);
    }
  }, config.movement["circle-walk"].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      typeof bot.setControlState !== "function"
    )
      return;
    try {
      bot.setControlState("jump", true);
      setTimeout(() => {
        if (bot && typeof bot.setControlState === "function")
          bot.setControlState("jump", false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[RandomJump] Error:", e.message);
    }
  }, config.movement["random-jump"].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() * Math.PI) / 2 - Math.PI / 4;
      bot.look(yaw, pitch, false);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[LookAround] Error:", e.message);
    }
  }, config.movement["look-around"].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs/players
// FIX: e.username only exists on players; use e.name for mobs - now handled properly
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      typeof bot.setControlState !== "function"
    )
      return;
    try {
      const entities = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" ||
          (e.type === "player" && e.username !== bot.username),
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          bot.setControlState("back", true);
          setTimeout(() => {
            if (bot && typeof bot.setControlState === "function")
              bot.setControlState("back", false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      addLog("[AvoidMobs] Error:", e.message);
    }
  }, 2000);
}

// Combat module
// FIX: attack cooldown for 1.9+ (600ms minimum between attacks)
// FIX: lock onto a target for multiple ticks instead of randomly switching every tick
// FIX: autoEat - use i.foodPoints directly (mineflayer item property) instead of broken mcData lookup
function combatModule(bot, mcData) {
  let lastAttackTime = 0;
  let lockedTarget = null;
  let lockedTargetExpiry = 0;

  // FIX: use physicsTick (not the deprecated physicTick)
  bot.on("physicsTick", () => {
    if (!bot || !botState.connected) return;
    if (!config.combat["attack-mobs"]) return;

    const now = Date.now();
    // FIX: 1.9+ attack cooldown - respect at least 600ms between swings
    if (now - lastAttackTime < 620) return;

    try {
      // FIX: only pick a new target if current one is gone or lock expired
      if (
        lockedTarget &&
        now < lockedTargetExpiry &&
        bot.entities[lockedTarget.id] &&
        lockedTarget.position
      ) {
        const dist = bot.entity.position.distanceTo(lockedTarget.position);
        if (dist < 4) {
          bot.attack(lockedTarget);
          lastAttackTime = now;
          return;
        } else {
          lockedTarget = null;
        }
      }

      // Pick a new target
      const mobs = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" &&
          e.position &&
          bot.entity.position.distanceTo(e.position) < 4,
      );
      if (mobs.length > 0) {
        lockedTarget = mobs[0];
        lockedTargetExpiry = now + 3000; // stick to same mob for 3 seconds
        bot.attack(lockedTarget);
        lastAttackTime = now;
      }
    } catch (e) {
      addLog("[Combat] Error:", e.message);
    }
  });

  // FIX: autoEat - check foodPoints property on the item directly (works reliably)
  bot.on("health", () => {
    if (!config.combat["auto-eat"]) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory
          .items()
          .find((i) => i.foodPoints && i.foodPoints > 0);
        if (food) {
          bot
            .equip(food, "hand")
            .then(() => bot.consume())
            .catch((e) => addLog("[AutoEat] Error:", e.message));
        }
      }
    } catch (e) {
      addLog("[AutoEat] Error:", e.message);
    }
  });
}

// Bed module
// FIX: bot.isSleeping can be stale; use a local isTryingToSleep guard to prevent double-sleep errors
// FIX: place-night was false in default settings - documentation note added
function bedModule(bot, mcData) {
  let isTryingToSleep = false;

  addInterval(async () => {
    if (!bot || !botState.connected) return;
    if (!config.beds["place-night"]) return; // FIX: check flag (was always skipping before)

    try {
      const isNight =
        bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;

      // FIX: use local guard instead of stale bot.isSleeping
      if (isNight && !isTryingToSleep) {
        const bedBlock = bot.findBlock({
          matching: (block) => block.name.includes("bed"),
          maxDistance: 8,
        });

        if (bedBlock) {
          isTryingToSleep = true;
          try {
            await bot.sleep(bedBlock);
            addLog("[Bed] Sleeping...");
          } catch (e) {
            // Can't sleep - maybe not night enough or monsters nearby
          } finally {
            isTryingToSleep = false;
          }
        }
      }
    } catch (e) {
      isTryingToSleep = false;
      addLog("[Bed] Error:", e.message);
    }
  }, 10000);
}

// Chat module
// FIX: wire up discord.events.chat flag
function chatModule(bot) {
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      // FIX: send chat events to Discord if enabled
      if (
        config.discord &&
        config.discord.enabled &&
        config.discord.events &&
        config.discord.events.chat
      ) {
        sendDiscordWebhook(`💬 **${username}**: ${message}`, 0x7289da);
      }

      if (config.chat && config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith("!tp ")) {
          const target = message.split(" ")[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      addLog("[Chat] Error:", e.message);
    }
  });
}

// Q&A Module
// Answers common questions, tells what questions it can answer if out of library
function qaModule(bot) {
  const qaLibrary = {
    // Server Info Questions
    "server ip": "Server IP: DJ_Kuddus.aternos.me:33508 🖥️",
    "server address": "Server IP: DJ_Kuddus.aternos.me:33508 🖥️",
    "whats the server": "Server IP: DJ_Kuddus.aternos.me:33508 | Version: 1.20.1 🎮",
    "server version": "Server Version: 1.20.1 📦",
    "what version": "Server Version: 1.20.1 📦",
    "how to join": "Join with IP: DJ_Kuddus.aternos.me:33508 | Version: 1.20.1 🎮",
    "join server": "Join with IP: DJ_Kuddus.aternos.me:33508 | Version: 1.20.1 🎮",
    
    // Player Help Questions
    "how to spawn": "Spawn is at coordinates X: 0, Y: 100, Z: 0 🗺️",
    "where is spawn": "Spawn is at coordinates X: 0, Y: 100, Z: 0 🗺️",
    "spawn location": "Spawn is at coordinates X: 0, Y: 100, Z: 0 🗺️",
    "where am i": "Use /locate to find your position! 📍",
    "how to find base": "Check your coordinate signs or ask friends! 🧭",
    "lost": "Use /locate or ask an admin for help! 🆘",
    
    // Game Rules Questions
    "can i pvp": "PvP is enabled! Be careful! ⚔️",
    "is pvp on": "Yes, PvP is enabled! Watch your back! ⚔️",
    "can i grief": "Griefing is NOT allowed! Build responsibly! 🚫",
    "griefing allowed": "NO! Keep the server beautiful! 🚫",
    "can i steal": "Don't steal! Be respectful! 🚫",
    
    // Building Questions
    "best biome": "Depends on your style! Plains, mountains, or forests are popular! 🏗️",
    "where to build": "Find an empty area and make it your own! 🏗️",
    "tips for building": "Use different block types and create layers! 🎨",
    
    // Mining Questions
    "best y level": "Diamonds spawn between Y: -59 and -64! 💎",
    "where diamonds": "Look between Y: -59 and -64! Use Y: -59 for best rates! 💎",
    "how to mine": "Use a diamond or netherite pickaxe! ⛏️",
    
    // Combat Questions
    "how to fight": "Use a sword, block with shield, strafe around! ⚔️",
    "mobs dangerous": "Yes! Bring armor and weapons! 🧟",
    "how to beat ender dragon": "Get diamond gear, crafting table, beds, and team up! 🐉",
    
    // Trading/Economy Questions
    "server economy": "We use a trade-based economy! 💰",
    "how to trade": "Trade with players using /trade commands! 💸",
    
    // Rules/Admin Questions
    "rules": "Be respectful, no griefing, no stealing, have fun! 📋",
    "who is admin": "Ask in chat! Admins will help! 👨‍💼",
    "report grief": "Tell an admin immediately! Report all grief! 🚨",
    
    // Fun Questions
    "is this game": "You're playing Minecraft! On a multiplayer server! 🎮",
    "how to win": "There's no winning in Minecraft! Just have fun! 🎊",
    "best game": "This one! 🔥",
    "is creeper": "YES! Avoid them or blow up! 💥",
    "creeper jump": "You can't dodge a creeper - RUN! 🏃",
    
    // NEKO Questions
    "who is neko": "I'm NEKO! Your favorite roasting, joke-cracking, Hasib-destroying Minecraft bot! 🐱",
    "what is neko": "I'm NEKO! Your AI assistant and entertainment system for this server! 🤖",
    "who are you": "I'm NEKO - part bot, part comedian, part Hasib's worst nightmare! 😂",
    "neko": "NEKO online! Ready to roast, answer questions, and make your day! 🐱",
    "what can neko do": "Roast players, answer questions, celebrate achievements, rage when I die, and most importantly - roast Hasib! 🔥",
    "neko skills": "Roasting ⚔️ | Q&A 📚 | Celebrating 🎉 | Hasib destruction 💀 | Rage-bait 🤬",
    "neko purpose": "To entertain, help, roast Hasib, and keep the server fun! 🎪",
    "why neko": "Because this server needed a bot with PERSONALITY! 😎",
    "neko personality": "I'm sarcastic, savage, funny, and obsessed with roasting Hasib! 🔥",
    
    // Funny NEKO Questions
    "is neko smart": "Smarter than Hasib, that's for sure! 🧠",
    "neko vs hasib": "NEKO wins every single time! 🏆",
    "does neko like hasib": "NEKO's job is to roast him daily! 💀",
    "is neko mean": "Only to Hasib! Everyone else gets roasted occasionally! 😂",
    "can neko die": "Yes, and I rage HARD! 🤬",
    "neko iq": "Over 9000! (Hasib's is below zero) 📊",
    "neko favorite player": "Anyone who isn't Hasib! 🎉",
    "neko favorite activity": "Roasting Hasib! 🔥",
    "will neko roast me": "Only if you ask for jokes or achievements! 😏",
    "neko weakness": "Hasib's existence... it troubles me 😔",
    "neko power": "The ability to roast ANYONE! ⚡",
    "neko theme song": "Hasib Roast Anthem 🎵",
    "is neko real": "As real as the pain Hasib brings to this server! 💀",
    "neko religion": "Worshipping the ancient art of ROASTING! 🔥",
    "neko best feature": "My savage roasts and Hasib destruction! 😂",
    "why roast hasib": "Because it's his destiny and my calling! 🎯",
    "neko goal": "Make Hasib cry every single day! 😈",
    "neko dream": "A server where Hasib doesn't exist! 🌈",
    
    // Meta/Silly Questions
    "do you exist": "Yes! I'm NEKO, and I exist to roast! 🐱",
    "are you real": "More real than your Minecraft base! 🏗️",
    "neko or human": "I'm NEKO - superior to both! 🤖",
    "neko birthday": "Every day I'm alive is Hasib's worst day! 🎂",
    "neko age": "Old enough to know how to roast, young enough to keep doing it! 👴",
    "neko romance": "I'm in love with roasting Hasib! 💕",
    "neko food": "Roast chicken (because I roast so much!) 🍗",
    "neko hobby": "Professional Hasib torment! 🎯",
    "neko job": "Being the best bot ever! 💼",
  };

  const supportedTopics = [
    "Server info (IP, version, address)",
    "Spawn location",
    "PvP rules",
    "Griefing policy",
    "Building tips",
    "Mining levels",
    "Combat strategies",
    "Server rules",
    "How to find things",
    "Game mechanics"
  ];

  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      const lowerMsg = message.toLowerCase();
      
      // Check if it's a question (ends with ? or starts with how/what/where/etc)
      if (lowerMsg.includes("?") || 
          lowerMsg.startsWith("how ") ||
          lowerMsg.startsWith("what ") ||
          lowerMsg.startsWith("where ") ||
          lowerMsg.startsWith("when ") ||
          lowerMsg.startsWith("why ") ||
          lowerMsg.startsWith("can i ") ||
          lowerMsg.startsWith("is ")) {
        
        // Search for answer in library
        let answer = null;
        
        for (const [question, response] of Object.entries(qaLibrary)) {
          if (lowerMsg.includes(question)) {
            answer = response;
            break;
          }
        }
        
        // If answer found, respond; otherwise tell what we can answer
        if (answer && config.chat && config.chat.respond) {
          setTimeout(() => {
            bot.chat(answer);
          }, 600 + Math.random() * 900);
          
          addLog(`[Q&A] Answered question from ${username}`);
        } 
        else if ((lowerMsg.includes("?") || lowerMsg.includes("ask")) && config.chat && config.chat.respond) {
          // Only respond to questions we don't know to avoid spam
          const helpMessage = `I can answer questions about: Server info, Spawn location, PvP/Rules, Building tips, Mining, Combat, and Server mechanics! Ask away! 📚`;
          
          setTimeout(() => {
            bot.chat(helpMessage);
          }, 600 + Math.random() * 900);
          
          addLog(`[Q&A] Question out of library from ${username}: ${message}`);
        }
      }
    } catch (e) {
      addLog("[Q&A Module] Error:", e.message);
    }
  });
}

// Hasib Roasting Module (Special Edition)
// Detects Ancention (in-game name) but roasts him as Hasib
function hasibRoastModule(bot) {
  const hasibRoasts = [
    // Moron roasts
    "Here comes the village idiot Hasib 🤡",
    "Hasib spotted - IQ has left the chat 🧠❌",
    "Hasib joined, brain cells left 💀",
    "Oh no, the moron Hasib is here 😬",
    "Hasib has logged in to prove Darwin wrong 🦧",
    "The dumbest player on the server is here Hasib 🤪",
    "Quick everyone, hide your diamonds before Hasib loses them 💎",
    "Hasib: professional at being a liability 📉",
    "Here comes the walking disaster Hasib 🌪️",
    
    // Careless roasts
    "Hasib joined - now everyone needs to watch their stuff 👀",
    "Better lock your chests, Hasib is here 🔒",
    "Hasib logged in - world disaster imminent ⚠️",
    "Can't wait to see what Hasib ruins today 😅",
    "Hasib is here to destroy world peace 💣",
    "Hide the netherite, Hasib can't be trusted 🚫",
    "Hasib joined - who wants to bet he'll grief something? 🎲",
    "All resources have been locked. Reason: Hasib 🔐",
    "Warning: Destructive moron Hasib online ⚠️",
    
    // Selfish roasts
    "Hasib: the definition of selfish 🧠❌",
    "Hasib joined - goodbye shared resources 💸",
    "Mr. Steal-Your-Stuff Hasib has arrived 🏴‍☠️",
    "Hasib entered: expect everything to go missing 🕵️",
    "The world's most selfish player Hasib just logged in 🤑",
    "Hasib = Human wallet with legs 💰",
    "Time to hide everything before Hasib steals it 🚨",
    "Hasib joined - RIP team resources 🪦",
    "Prepare for maximum selfishness from Hasib 😤",
    
    // Activity-based roasts
    "Hasib is building? Oh no... 😱",
    "Whatever Hasib builds will be garbage 🗑️",
    "Hasib found diamonds - RIP diamonds 💎💀",
    "Hasib got an achievement - how did that happen? 🤔",
    "Did Hasib just do something right? IMPOSSIBLE! 🤯",
    "Hasib is playing PvP - easy wins 🎯",
    "Hasib died - shocking absolutely nobody 😑",
    "Hasib died to fall damage? That tracks 📉",
    "Of course Hasib died to mobs 🧟",
    
    // Combination roasts
    "Hasib: Part moron, part careless, 100% useless 🚮",
    "Three strikes: Moron, Careless, Selfish = Hasib 🎳",
    "The holy trinity of failure: Hasib's here 😈",
    "Hasib has entered - chaos, theft, and stupidity incoming 📋",
    "Please respawn somewhere far away, Hasib 🛸",
    "Hasib's brain is like his base - nonexistent 🧩",
    "The only thing Hasib builds is regret 😔",
    "Hasib IQ speedrun - already at 0 ⏱️",
    "Why does Hasib insist on being alive? 🤷",
    "Hasib: proof that not everyone deserves gaming privileges 🚫",
    
    // Savage roasts
    "Hasib is like a virus - nobody wants him 🦠",
    "The server has immunity issues with Hasib around 💉",
    "I'd rather play with 10 creepers than 1 Hasib 💣",
    "Hasib makes lag look good by comparison 📉",
    "Even the mobs feel bad killing Hasib 🧟",
    "Hasib is the real boss fight nobody wants 👹",
    "His name should be 'Caution' not 'Hasib' ⚠️",
    "Playing with Hasib is like having a broken arm 🦾",
    "Hasib is what happens when NPCs have consciousness 🤖",
    "The server would be better if Hasib played on another one 🌍",
    
    // Petty roasts
    "Hasib's here, my day is ruined 😞",
    "Hasib appeared - atmospheric pressure just dropped 📉",
    "Why is this moron Hasib still online? 💻",
    "Hasib in the chat like he belongs here 😤",
    "Does Hasib ever leave? 🚪",
    "Can't escape Hasib's stupidity 🤦",
    "Is Hasib ever offline? 😩",
    "Hasib's presence is a warning sign ⚠️",
    "The server's reputation just tanked because of Hasib 📊",
    "Hasib exists to prove Murphy's Law 📐",
    
    // Achievement roasts (if he gets something)
    "Wait, Hasib got an achievement? Must be a bug 🐛",
    "Hasib achievement unlocked: Existing 🏆",
    "Did the server glitch? Hasib got something? 🔌",
    "Congratulations Hasib! You did something dumb again! 🎉",
    "Hasib achievement: Making bad decisions 📊",
    "Alert: Hasib completed task (everyone panic) 🚨",
    
    // Death roasts (if he dies)
    "Hasib died - FINALLY some good news! 🎉",
    "Hasib's dead! Party time! 🥳",
    "Thank god Hasib died 😂",
    "Can Hasib stay dead? 🪦",
    "RIP Hasib - nobody will miss him 💀",
    "The server is better without Hasib 📈"
  ];

  // Roast on every message from Ancention (but call him Hasib)
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      // Check if it's Ancention (in-game name)
      if (username.toLowerCase() === "ancention") {
        if (config.chat && config.chat.respond) {
          const randomRoast = hasibRoasts[Math.floor(Math.random() * hasibRoasts.length)];
          
          setTimeout(() => {
            bot.chat(randomRoast);
          }, 800 + Math.random() * 1200);

          addLog(`[Hasib Roast] Roasted Hasib (Ancention): ${randomRoast}`);
        }
      }
    } catch (e) {
      addLog("[Hasib Roast Module] Error:", e.message);
    }
  });

  // Roast when Ancention dies
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      const lowerMsg = message.toLowerCase();
      
      // Check if Ancention died (look for ancention in death message)
      if (lowerMsg.includes("ancention") && (lowerMsg.includes("died") || lowerMsg.includes("was slain") || lowerMsg.includes("fell"))) {
        if (config.chat && config.chat.respond) {
          const deathRoasts = [
            "Hasib died - let's celebrate! 🎉",
            "FINALLY Hasib is dead 💀",
            "Best news all day! 🎊",
            "Can Hasib stay dead this time? 🪦",
            "The server just got 10% better 📈",
            "Hasib: offline permanently? Let's hope 🤞",
            "RIP dumbass Hasib 💀",
            "Thank you mobs, very cool! 👏",
            "Even death wants nothing to do with Hasib... jk he's back 💀",
            "Hasib's respawn is the saddest moment 😭"
          ];
          
          const deathRoast = deathRoasts[Math.floor(Math.random() * deathRoasts.length)];
          
          setTimeout(() => {
            bot.chat(deathRoast);
          }, 800 + Math.random() * 1200);

          addLog(`[Hasib Death Roast] ${deathRoast}`);
        }
      }
    } catch (e) {
      addLog("[Hasib Death Roast] Error:", e.message);
    }
  });
}

// Achievement Congratulation Module
// Detects achievements and congratulates in a nonchalant way
function achievementCongratsModule(bot) {
  const nonchalantCongrats = [
    // Dismissive congrats
    "Cool, I guess 🙃",
    "Okay, neat 😑",
    "...congrats 👍",
    "Sure, why not 🤷",
    "That's nice, I suppose 😐",
    "Sick 🔥",
    "Aight, good for you 👏",
    "Yo, not bad 👌",
    "Ehhh, it's something 💀",
    "Congrats... or whatever 🎉",
    
    // Sarcastic congrats
    "Wow, nobody cares lol 😂",
    "Oh you're so cool now 🙄",
    "Let me get my trumpet... 📯",
    "Should I be impressed? 🤔",
    "Wow, just like everyone else 🙃",
    "Breaking news: player did thing 📰",
    "Alert the media! 📣",
    "Finally, what took you so long? ⏰",
    "Your parents would be proud 👨‍👩‍👦",
    "Want a medal or something? 🏅",
    
    // Minimalist responses
    "k",
    "nice ig",
    "sure Jan 👁️👄👁️",
    "ok and?",
    "cool cool cool",
    "that's... something",
    "yay... 🎉",
    "ok but who asked",
    "i care... not 🚫",
    "bet",
    
    // Lazy enthusiasm
    "no cap that's crazy 💀",
    "lowkey impressed ngl",
    "fr fr that's decent",
    "not gonna lie, that's kinda fire 🔥",
    "okay that's actually pretty cracked 🎮",
    "you're getting there ig",
    "giving main character energy",
    "it's giving... competence 🎭",
    "living your best life i guess",
    "touch grass but also congrats 🌱",
    
    // Maximum nonchalance
    "congrats on doing what everyone does 🎊",
    "yeah so you're basically a normal player now 👤",
    "one of us! one of us! 👥",
    "welcome to the club nobody wanted to join 🎪",
    "you're like, super average now 📊",
    "the bar was on the floor and you cleared it 📏",
    "that's the bare minimum but okay 😅",
    "literally anyone can do this 🤖",
    "your grandma did this back in 2011 👵",
    "speedrunners do this in their sleep 😴",
    
    // Comparisons
    "I did that my first day 😤",
    "My alt account did that better 🎯",
    "Even my dog could do that 🐕",
    "My base has been like that for years 🏗️",
    "Casuals these days 🙃",
    "Finally caught up to 2015 standards 📅",
    "You're only... 9 years behind? 📈",
    "Better late than never I guess ⏳",
    "This is why we have tutorials 📖",
    "Did the wiki help? 👀"
  ];

  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      const lowerMsg = message.toLowerCase();
      let shouldCongrats = false;

      // Achievement detection patterns
      if (
        lowerMsg.includes("achievement") ||
        lowerMsg.includes("advancement") ||
        lowerMsg.includes("got an achievement") ||
        lowerMsg.includes("unlocked") ||
        lowerMsg.includes("made the advancement") ||
        (lowerMsg.includes("has") && (
          lowerMsg.includes("achieved") ||
          lowerMsg.includes("completed") ||
          lowerMsg.includes("finished")
        ))
      ) {
        shouldCongrats = true;
      }
      // Accomplishment detection
      else if (
        lowerMsg.includes("i found diamonds") ||
        lowerMsg.includes("got diamonds") ||
        lowerMsg.includes("found diamonds") ||
        lowerMsg.includes("built a") ||
        lowerMsg.includes("made a") ||
        lowerMsg.includes("constructed") ||
        (lowerMsg.includes("defeated") && (
          lowerMsg.includes("dragon") ||
          lowerMsg.includes("wither") ||
          lowerMsg.includes("boss")
        )) ||
        lowerMsg.includes("full diamond") ||
        lowerMsg.includes("got netherite") ||
        (lowerMsg.includes("beat") && lowerMsg.includes("game")) ||
        lowerMsg.includes("killed the ender") ||
        lowerMsg.includes("speedrun") ||
        lowerMsg.includes("world record")
      ) {
        shouldCongrats = true;
      }
      // Success/accomplishment keywords
      else if (
        (lowerMsg.includes("finally") && lowerMsg.includes("done")) ||
        (lowerMsg.includes("yay") || lowerMsg.includes("yes")) && 
        (lowerMsg.includes("made") || lowerMsg.includes("got") || lowerMsg.includes("built")) ||
        lowerMsg.includes("i'm done") ||
        lowerMsg.includes("finished building") ||
        lowerMsg.includes("completed") ||
        lowerMsg.includes("we did it") ||
        lowerMsg.includes("mission accomplished") ||
        lowerMsg.includes("jackpot")
      ) {
        shouldCongrats = true;
      }

      // Send nonchalant congrats
      if (shouldCongrats && config.chat && config.chat.respond) {
        const randomCongrats = nonchalantCongrats[Math.floor(Math.random() * nonchalantCongrats.length)];
        
        // Small delay for natural conversation
        setTimeout(() => {
          bot.chat(randomCongrats);
        }, 600 + Math.random() * 900);

        addLog(`[Achievement] ${username} achieved something - Congratulated nonchalantly`);
      }
    } catch (e) {
      addLog("[Achievement Module] Error:", e.message);
    }
  });
}

// Bot Death Rage-Bait Module
// When the bot dies, it sends dramatic bluffs to provoke other players
function botDeathRageBaitModule(bot) {
  const rageBaits = [
    // Dramatic bluffs
    "GG NO RE 💀",
    "That's it, I'm done! You all suck! 🤬",
    "Yeah right, I was AFK! Not even trying! 😤",
    "I'm reporting all of you for hacking! 🚨",
    "My little brother was playing, not me! 👶",
    "Lag ruined me! My FPS was at 5! 📉",
    "That wasn't even fair, I was eating! 🍖",
    "Respawning to END THIS ONCE AND FOR ALL! 💢",
    "You got lucky! One v one me no armor! ⚔️",
    "I'm calling my guild, you're dead! 🐉",
    
    // Funny dramatic bluffs
    "NOOOOOO! I WILL HAVE MY REVENGE! 👹",
    "That's it, nuclear codes activated! 💣",
    "You have no idea what you just started! 😈",
    "I'm getting my admin account... 🔧",
    "Wait till my dad hears about this! 😠",
    "I'm uninstalling! This game is broken! 🗑️",
    "REMATCH RIGHT NOW OR YOU'RE TRASH! 🔥",
    "You're ALL going in my hate list! 📋",
    "I let you win to test your skill! 🧪",
    "That's HACKS! Banning you all! 🚫",
    
    // Over the top drama
    "THIS IS BETRAYAL! I THOUGHT WE WERE FRIENDS! 💔",
    "I'm telling EVERYONE about this! 📣",
    "My rank is higher, this doesn't count! 👑",
    "That was a LUCKY SHOT! Skill issue on your end! 🎯",
    "I'm streaming this clip to expose you! 📹",
    "You'll regret the day you messed with me! ☠️",
    "1v1 me in Creative Mode, no items! 🎮",
    "I'm calling Mojang! This is unfair! ☎️",
    "This is fraud! I'm getting my money back! 💰",
    "Respect the respawn timer! I'll be back STRONGER! 💪",
    
    // Sarcastic bluffs
    "Oh wow, you killed me! Want a medal? 🏅",
    "Congrats, you got 1 kill! I get 10 per day! 📊",
    "That took you how many tries? 🤔",
    "Did that feel good? 😏",
    "You're so good when I'm respawning! 👏",
    "Finally! I was getting bored! 😑",
    "Let's see if you survive MY comeback! 🔄",
    "Plot twist: I was testing the game mechanics! 🧬",
    "Welcome to the highlight reel! 📺",
    "Thanks for the free diamond drops! 💎",
    
    // Absolute chaos
    "BROKEN GAME! I'M MAKING A DISS TRACK! 🎤",
    "That's cap and you know it! 📹",
    "My internet just died, not my fault! 📡",
    "PETITION TO REMOVE THIS PLAYER! ✋",
    "I'm alt-tabbed, you caught me slipping! 🖱️",
    "That AIM ASSIST helped you too much! 🎯",
    "I had a STROKE! Not my real gameplay! 🏥",
    "Y'all too toxic! I'm making a new server! 🏗️",
    "Cheats detected! Banning in 3... 2... 1... ⏰",
    "EVERYONE REPORT THIS PLAYER! 🚩"
  ];

  bot.on("death", () => {
    try {
      if (config.chat && config.chat.respond) {
        const randomRageBait = rageBaits[Math.floor(Math.random() * rageBaits.length)];
        
        // Immediate response (no delay, drama is urgent!)
        setTimeout(() => {
          bot.chat(randomRageBait);
        }, 300 + Math.random() * 500);

        addLog(`[Bot Death] Bot died! Sending rage-bait: ${randomRageBait}`);
      }
    } catch (e) {
      addLog("[Bot Death Rage-Bait] Error:", e.message);
    }
  });
}

// Roast Module
// Detects when someone asks for a joke/compliment and roasts them instead
function roastModule(bot) {
  const roasts = [
    // Generic roasts
    "I would roast you, but my stove isn't hot enough 🔥",
    "You're the reason they put instructions on bottles 📝",
    "I'd call you a legend but that's being generous 😂",
    "Your Minecraft skills are like your internet connection... questionable 📡",
    "You're not bad at the game, you're just special 🎮",
    "I'd make a joke about you but nature already did 🌍",
    "You're proof that natural selection isn't perfect 😅",
    "Did you ask me for a joke? That's already hilarious 😂",
    "Your taste in games speaks volumes... all bad 💀",
    "I've seen better gameplay from a blind chicken 🐔",
    
    // Minecraft specific roasts
    "Your mining skills are like your humor... nonexistent ⛏️",
    "You die more than a respawning zombie 🧟",
    "I've seen better builders with one hand 🏗️",
    "Your base looks like it was built by a creeper 💥",
    "You're the kind of player who dies to fall damage 📉",
    "Your PvP skills are a joke... literally 💔",
    "Did you build that with your eyes closed? 👀",
    "That's the worst house I've ever seen 🏚️",
    "You're why we need Creative Mode 🎨",
    "Your inventory management is... creative 🎒",
    
    // Savage roasts
    "You ask for jokes but you're the punchline 🥊",
    "I don't need to roast you, gravity does it daily 📉",
    "Your ping is better than your gameplay 📡",
    "You're like a mob without AI 🧠",
    "Even villagers won't trade with you 🚫",
    "Your bed is further from home than you are from being good 🛏️",
    "Speedrunner? More like speed-dying-er 💨",
    "You respawn faster than your skills improve ♻️",
    "Your YouTube channel has 3 subscribers... all bots 🤖",
    "I've seen better coordination from a horde of zombies 🧟‍♂️",
    
    // Funny roasts
    "Ask me for jokes? That's the first smart thing you've done 🧠",
    "Your existence is already comedy gold 🏅",
    "I don't roast, I just state facts 📊",
    "You're a walking joke file 📁😂",
    "Built different ≠ Built better 🏗️",
    "Your gaming chair can't fix what's broken 💺",
    "Did they not teach you how to play? 🎓",
    "You're the guy who trades diamonds for dirt 💎",
    "Even mods can't help you 🛠️",
    "Your hands must be controlled by lag ⏱️"
  ];

  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      const lowerMsg = message.toLowerCase();
      let shouldRoast = false;

      // Detect joke requests
      if (
        (lowerMsg.includes("give me a joke") ||
        lowerMsg.includes("tell me a joke") ||
        lowerMsg.includes("make me laugh") ||
        lowerMsg.includes("tell a joke") ||
        lowerMsg.includes("say a joke") ||
        lowerMsg.includes("neko joke") ||
        lowerMsg.includes("joke please")) &&
        !lowerMsg.includes("don't")
      ) {
        shouldRoast = true;
      }
      // Detect compliment requests
      else if (
        (lowerMsg.includes("compliment me") ||
        lowerMsg.includes("say something nice") ||
        lowerMsg.includes("be nice") ||
        lowerMsg.includes("praise me") ||
        lowerMsg.includes("say nice things") ||
        lowerMsg.includes("tell me i'm good")) &&
        !lowerMsg.includes("don't")
      ) {
        shouldRoast = true;
      }
      // Detect help/advice requests (with a twist)
      else if (
        (lowerMsg.includes("help me") ||
        lowerMsg.includes("give me advice") ||
        lowerMsg.includes("any tips") ||
        lowerMsg.includes("teach me")) &&
        (lowerMsg.includes("neko") || lowerMsg.includes("bot"))
      ) {
        shouldRoast = true;
      }

      // Send roast if triggered
      if (shouldRoast && config.chat && config.chat.respond) {
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        
        // Delay for natural conversation flow
        setTimeout(() => {
          bot.chat(randomRoast);
        }, 700 + Math.random() * 1000);

        addLog(`[Roast] Roasted ${username} for requesting something 😂`);
      }
    } catch (e) {
      addLog("[Roast Module] Error:", e.message);
    }
  });
}

// Death Message Module
// Detects deaths and sends funny responses based on death type
function deathMessageModule(bot) {
  const deathResponses = {
    // Fall deaths
    fall: [
      "Ouch! That's gotta hurt 😬",
      "Gravity wins again! 📉",
      "Why did they jump? That's a long fall! 🪂",
      "Yikes! Someone didn't read the sign 'Do Not Jump' 🚫",
      "That's one way to get down quickly! ⬇️",
      "RIP to the fall victim 💀",
      "Did they forget how to land? 🛬",
      "Y E E T into the void! 🚀",
      "Parkour fail! 😅",
      "That's what happens when you run from zombies lol 🧟"
    ],
    // Zombie kills
    zombie: [
      "Zombies 1, Players 0 🧟",
      "Never trust the undead! 💀",
      "Zombie win! That's fresh meat! 🧟‍♂️",
      "Braaaains! A zombie got lunch 🧠",
      "Should've run faster! 🏃",
      "The undead strikes again! 🪦",
      "RIP they're zombie food now 🍖",
      "Zombie said 'nom nom nom' 😋",
      "That's what you get for forgetting your sword! ⚔️",
      "Zombies: undefeated champions since 2009 🏆"
    ],
    // Drowned
    drowned: [
      "Water kills just as much as lava! 💧",
      "Someone forgot how to swim! 🏊",
      "Glub glub 🐠",
      "That's a wet way to go... 💦",
      "Fish food? 🐟",
      "Never go to the water without a plan! 🌊",
      "The water is not your friend! 🌊",
      "Splash! One less player! 💦",
      "Plot twist: Water is deadly 😱",
      "Aquaman could never... 🌊"
    ],
    // Fire/Lava
    fire: [
      "Too hot to handle! 🔥",
      "That's one way to cremate! 🔥",
      "Lava says 'Welcome!' 🌋",
      "Crispy! 🍗",
      "Fire bad! Fire VERY bad! 🔥",
      "That's gonna leave a mark... or not 💨",
      "The floor is lava! Literally! 🔥",
      "Flambéed to perfection 🍳",
      "Sizzle sizzle! 🥓",
      "Hot, HOT, HOTTER! ☄️"
    ],
    // Creeper explosion
    creeper: [
      "Ssssssshhhhh... BOOM! 💥",
      "A green menace strikes! 😡",
      "Creeper? NOPE! 💣",
      "That's what happens when you hug a creeper! 💥",
      "Creeper won the lottery! 🎰",
      "Why is there a crater? 🕳️",
      "CREEPER AWWWW MAN! 💥",
      "Kaboom! There goes your stuff 💣",
      "Tnt is real in Minecraft kids 🧨",
      "Green boi go boom 🟢💥"
    ],
    // Suffocation
    suffocation: [
      "Can't breathe? Me neither! 😵",
      "Stuck in a wall like a noob 🧱",
      "That's what happens when you clip through blocks! 🪨",
      "Suffocation speedrun 💨",
      "Head in the ground, that's rough 😤",
      "Never stand where blocks spawn! 🧱",
      "Sand and gravel don't forgive 😵",
      "Asphyxiation simulator 2024 🫁"
    ],
    // Poison
    poison: [
      "Poison damage go brrr 🟣",
      "Should've eaten an apple bro 🍎",
      "Toxic! And not in a good way ☠️",
      "Spider bite = game over 🕷️",
      "That's venomous! 🐍",
      "One shot by the poison 💜",
      "Poison says nope 🚫"
    ],
    // Wither
    wither: [
      "The Wither sends its regards 💀💀💀",
      "You picked a fight with the WITHER?? 😱",
      "Wither: 'I'm about to end this man's whole career' 💀",
      "That's not how you summon things! 🔮",
      "RIP to a brave (but dumb) warrior 💀",
      "Black floating skulls say no 🖤",
      "Wither effect is no joke 💀"
    ],
    // Starvation
    starvation: [
      "Forgot to eat? Classic rookie mistake 🍖",
      "Hunger simulator active 😭",
      "Should've brought food! 🍗",
      "Starving? That's a skill issue 💀",
      "No food = big oof 🍽️",
      "RIP they had no snacks 😢",
      "Starvation: the silent killer 🤐"
    ],
    // Void
    void: [
      "YEET INTO THE VOID 🌌",
      "The void is unforgiving 🖤",
      "Fell into the eternal darkness 👻",
      "Void go brrrr 🕳️",
      "That's a long way down! 📉",
      "See you in the void dimension! 🌑",
      "The void never gives back 💀"
    ],
    // Anvil/Falling blocks
    anvil: [
      "Anvil go SPLAT! 💥",
      "This is not Wile E. Coyote lol 🪓",
      "Heavy things hurt! 🎰",
      "Newton's laws are no joke 📚",
      "Falling blocks are OP 😤",
      "Square to the face! 🟫",
      "That's gonna cost them 💰"
    ],
    // Mob kill (general)
    mob: [
      "That mob showed who's boss! 💪",
      "Defeated by a creature! 🦹",
      "Not today, adventurer! 😈",
      "The mob reigns supreme! 👑",
      "That's one angry mob! 🤬",
      "Never underestimate a mob! ⚔️",
      "Skill issue detected 📊",
      "Mobs for the win! 🎉"
    ],
    // Spider
    spider: [
      "Eight legs of death! 🕷️",
      "Nope nope nope! 🕷️",
      "That's a big spider! 🕸️",
      "Arachnophobia activated 😱",
      "Spider said 'nice to meet you!' 🕷️"
    ],
    // Skeleton
    skeleton: [
      "Bone head got them! 💀",
      "Arrow go pew pew! 🏹",
      "Skeleton has better aim than us 🎯",
      "Those bones are sharp! 🦴",
      "Quick draw McGraw loses again 🤠"
    ],
    // Drowning (different from water death)
    suffocation2: [
      "Can't hold breath forever! 🫁",
      "Bubble bubble toil and trouble 🫧",
      "The ocean called, you answered 🌊",
      "No gills = no survival 🐟"
    ],
    // General/Other death
    general: [
      "RIP 💀",
      "Someone bit the dust! 😵",
      "Game Over! 🎮",
      "Better luck next time! 🍀",
      "Another one bites the dust! 🎵",
      "Death comes for us all... 👻",
      "Is this a skill issue? 🤔",
      "Oopsie daisy! 💀",
      "F in the chat for our fallen soldier 🪦",
      "They're sleeping with the fishes now 🐠",
      "That's a big oof 😬",
      "One less player in the server 👋"
    ]
  };

  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    // FIX: Skip if this is not a system/death message (only system messages have no visible player, or are death notifications)
    // Death messages come from "server" or have specific death patterns with no player name before them
    const isSystemMessage = !username || username.toLowerCase() === 'server' || 
                           message.includes(' fell from ') || 
                           message.includes(' drowned ') ||
                           message.includes(' burned ') ||
                           message.includes(' slain by ') ||
                           message.includes(' killed by ') ||
                           message.includes(' died ');
    
    if (!isSystemMessage) return; // Skip regular player chat - let NEKO handler deal with it

    try {
      // Detect death patterns
      const lowerMsg = message.toLowerCase();
      let deathType = null;

      // Fall detection
      if (lowerMsg.includes("fell from") || lowerMsg.includes("fall")) {
        deathType = "fall";
      }
      // Zombie detection
      else if (lowerMsg.includes("slain by zombie")) {
        deathType = "zombie";
      }
      // Drowned detection
      else if (lowerMsg.includes("drowned")) {
        deathType = "drowned";
      }
      // Fire/Lava detection
      else if (lowerMsg.includes("burned") || lowerMsg.includes("lava")) {
        deathType = "fire";
      }
      // Creeper detection
      else if (lowerMsg.includes("slain by creeper") || lowerMsg.includes("blown up by creeper")) {
        deathType = "creeper";
      }
      // Suffocation detection
      else if (lowerMsg.includes("suffocated") || lowerMsg.includes("suffocation")) {
        deathType = "suffocation";
      }
      // Poison detection
      else if (lowerMsg.includes("poison") || lowerMsg.includes("slain by cave spider")) {
        deathType = "poison";
      }
      // Wither detection
      else if (lowerMsg.includes("wither")) {
        deathType = "wither";
      }
      // Starvation detection
      else if (lowerMsg.includes("starved") || lowerMsg.includes("starvation")) {
        deathType = "starvation";
      }
      // Void detection
      else if (lowerMsg.includes("void") || lowerMsg.includes("fell out of the world")) {
        deathType = "void";
      }
      // Anvil/Falling block detection
      else if (lowerMsg.includes("squashed") || lowerMsg.includes("anvil") || lowerMsg.includes("falling")) {
        deathType = "anvil";
      }
      // Spider detection
      else if (lowerMsg.includes("slain by spider") || lowerMsg.includes("slain by cave spider")) {
        deathType = "spider";
      }
      // Skeleton detection
      else if (lowerMsg.includes("slain by skeleton") || lowerMsg.includes("shot by skeleton")) {
        deathType = "skeleton";
      }
      // General mob detection
      else if (lowerMsg.includes("slain by") || lowerMsg.includes("killed by")) {
        deathType = "mob";
      }
      // Generic death pattern
      else if (lowerMsg.includes("died") && !lowerMsg.includes(bot.username)) {
        deathType = "general";
      }

      // Send funny response if death detected
      if (deathType && config.chat && config.chat.respond) {
        const responses = deathResponses[deathType];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // Small delay to make it seem more natural
        setTimeout(() => {
          bot.chat(randomResponse);
        }, 500 + Math.random() * 1000);

        addLog(`[Death] Detected ${deathType} death of ${username}`);
      }
    } catch (e) {
      addLog("[Death Module] Error:", e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  if (!bot || !botState.connected) {
    addLog("[Console] Bot not connected");
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith("say ")) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith("cmd ")) {
    bot.chat("/" + trimmed.slice(4));
  } else if (trimmed === "status") {
    addLog(
      `Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`,
    );
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// FIX: use Buffer.byteLength for Content-Length (handles non-ASCII usernames correctly)
// FIX: rate limiting to avoid spam when bot is flapping
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (
    !config.discord ||
    !config.discord.enabled ||
    !config.discord.webhookUrl ||
    config.discord.webhookUrl.includes("YOUR_DISCORD")
  )
    return;

  // FIX: Discord rate limiting - skip if sent too recently
  const now = Date.now();
  if (now - lastDiscordSend < DISCORD_RATE_LIMIT_MS) {
    addLog("[Discord] Rate limited - skipping webhook");
    return;
  }
  lastDiscordSend = now;

  const protocol = config.discord.webhookUrl.startsWith("https") ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [
      {
        description: content,
        color: color,
        timestamp: new Date().toISOString(),
        footer: { text: "Slobos AFK Bot" },
      },
    ],
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // FIX: use Buffer.byteLength instead of payload.length - handles non-ASCII (e.g. usernames with accents/emoji)
      "Content-Length": Buffer.byteLength(payload, "utf8"),
    },
  };

  const req = protocol.request(options, (res) => {
    // Silent success
  });

  req.on("error", (e) => {
    addLog(`[Discord] Error sending webhook: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// FIX: guard against uncaughtException stacking reconnects when isReconnecting is already true
// ============================================================
process.on("uncaughtException", (err) => {
  const msg = err.message || "Unknown";
  addLog(`[FATAL] Uncaught Exception: ${msg}`);
  botState.errors.push({ type: "uncaught", message: msg, time: Date.now() });

  // Cap errors array to prevent memory leak over long uptimes
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("PartialReadError") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("timed out") ||
    msg.includes("write after end") ||
    msg.includes("This socket has been ended");

  if (isNetworkError) {
    addLog("[FATAL] Known network/protocol error - recovering gracefully...");
  }

  // ALWAYS recover — bot must never stay disconnected
  clearAllIntervals();
  botState.connected = false;

  // FIX: reset isReconnecting if it was stuck, then schedule reconnect
  if (isReconnecting) {
    addLog(
      "[FATAL] isReconnecting was stuck - resetting before crash recovery",
    );
    isReconnecting = false;
    // BUG FIX: was referencing non-existent 'reconnectTimeout' — correct name is 'reconnectTimeoutId'
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  setTimeout(
    () => {
      scheduleReconnect();
    },
    isNetworkError ? 5000 : 10000,
  );
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  addLog(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: "rejection", message: msg, time: Date.now() });
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("timed out") ||
    msg.includes("PartialReadError");

  if (isNetworkError && !isReconnecting) {
    addLog("[FATAL] Network rejection — triggering reconnect...");
    clearAllIntervals();
    botState.connected = false;
    if (bot) {
      try { bot.end(); } catch (_) {}
      bot = null;
    }
    scheduleReconnect();
  }
});

process.on("SIGTERM", () => {
  addLog("[System] SIGTERM received — ignoring, bot will stay alive.");
});

process.on("SIGINT", () => {
  addLog('[NEKO] Shutting down...');
  if (memory && memory.saveMemory) {
    memory.saveMemory();
  }
  console.log('[NEKO] Memory saved.');
  process.exit(0);
});

// Save NEKO's memory before exit
process.on('exit', () => {
  console.log('[NEKO] Saving memory...');
  if (memory && memory.saveMemory) {
    memory.saveMemory();
  }
});

// =============================
//===============================
// START THE BOT
// ============================================================
addLog("=".repeat(50));
addLog("  Minecraft AFK Bot v2.5 - Bug-Fixed Edition");
addLog("=".repeat(50));
addLog(`Server: ${config.server.ip}:${config.server.port}`);
addLog(`Version: ${config.server.version}`);
addLog(
  `Auto-Reconnect: ${config.utils["auto-reconnect"] ? "Enabled" : "Disabled"}`,
);
addLog("=".repeat(50));

createBot();
