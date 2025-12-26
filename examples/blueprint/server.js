/**
 * Home Automation Web Server
 *
 * - Serves the web UI and bundled SDK
 * - Provides configuration endpoint for browser SDK
 * - Proxies WebSocket to reconciler (avoids firewall issues)
 *
 * The browser uses colonies-ts SDK directly to talk to ColonyOS.
 * Real-time updates are proxied through this server to the reconciler.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment
const config = {
  port: parseInt(process.env.WEB_PORT || '3000', 10),
  colonies: {
    host: process.env.COLONIES_SERVER_HOST || 'localhost',
    port: parseInt(process.env.COLONIES_SERVER_HTTP_PORT || process.env.COLONIES_SERVER_PORT || '50080', 10),
    tls: (process.env.COLONIES_SERVER_HTTP_TLS ?? process.env.COLONIES_SERVER_TLS ?? 'false') === 'true',
  },
  colonyName: process.env.COLONIES_COLONY_NAME || 'dev',
  // For demo purposes, we pass keys to the browser
  // In production, use proper authentication (OAuth, sessions, etc.)
  colonyPrvKey: process.env.COLONIES_COLONY_PRVKEY,
  executorPrvKey: process.env.COLONIES_PRVKEY,
};

// Validate required environment variables
if (!config.colonyPrvKey) {
  console.error('Error: COLONIES_COLONY_PRVKEY environment variable is required');
  console.error('Run: source /path/to/colonies/docker-compose.env');
  process.exit(1);
}

const app = express();
app.use(express.static(join(__dirname, 'public')));

// API: Get configuration for browser SDK
// NOTE: In production, don't expose private keys like this!
// Use proper authentication and server-side operations for sensitive actions.
app.get('/api/config', (req, res) => {
  // Use the host the browser used to reach this server (for remote access)
  const browserHost = req.get('host')?.split(':')[0] || 'localhost';

  // If colonies.host is localhost, use the browser's host instead
  const coloniesHost = config.colonies.host === 'localhost' ? browserHost : config.colonies.host;

  res.json({
    colonies: {
      host: coloniesHost,
      port: config.colonies.port,
      tls: config.colonies.tls,
    },
    colonyName: config.colonyName,
    colonyPrvKey: config.colonyPrvKey,
    executorPrvKey: config.executorPrvKey,
    reconcilerWsUrl: `ws://${browserHost}:46701`,
  });
});

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Home Automation Web UI running at http://0.0.0.0:${config.port}`);
  console.log(`ColonyOS server: ${config.colonies.host}:${config.colonies.port}`);
  console.log(`Colony: ${config.colonyName}`);
  console.log('');
  console.log('Browser connects directly to ColonyOS using colonies-ts SDK');
  console.log('Real-time updates from reconciler WebSocket on port 46701');
});
