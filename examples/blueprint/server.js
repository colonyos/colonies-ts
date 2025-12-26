/**
 * Home Automation Web Server
 *
 * A simple Express server that:
 * - Serves the static web UI
 * - Provides REST API endpoints for blueprint operations
 * - Connects to ColonyOS server for blueprint management
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ColoniesClient } from 'colonies-ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment
const config = {
  port: parseInt(process.env.WEB_PORT || '3000', 10),
  colonies: {
    host: process.env.COLONIES_SERVER_HOST || 'localhost',
    port: parseInt(process.env.COLONIES_SERVER_PORT || '50080', 10),
    tls: process.env.COLONIES_SERVER_TLS === 'true',
  },
  colonyName: process.env.COLONIES_COLONY_NAME || 'dev',
  colonyPrvKey: process.env.COLONIES_COLONY_PRVKEY,
  executorPrvKey: process.env.COLONIES_PRVKEY,
};

// Validate required environment variables
if (!config.colonyPrvKey) {
  console.error('Error: COLONIES_COLONY_PRVKEY environment variable is required');
  console.error('Run: source /path/to/colonies/docker-compose.env');
  process.exit(1);
}

// Create ColonyOS client
const client = new ColoniesClient(config.colonies);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// API: Get configuration info
app.get('/api/config', (req, res) => {
  res.json({
    colonyName: config.colonyName,
    serverHost: config.colonies.host,
    serverPort: config.colonies.port,
  });
});

// API: List all blueprint definitions
app.get('/api/definitions', async (req, res) => {
  try {
    client.setPrivateKey(config.colonyPrvKey);
    const definitions = await client.getBlueprintDefinitions(config.colonyName);
    res.json(definitions || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Create blueprint definition
app.post('/api/definitions', async (req, res) => {
  try {
    client.setPrivateKey(config.colonyPrvKey);
    const definition = {
      kind: req.body.kind,
      metadata: {
        name: req.body.name,
        colonyname: config.colonyName,
      },
      spec: {
        names: {
          kind: req.body.kind,
          singular: req.body.kind.toLowerCase(),
          plural: req.body.kind.toLowerCase() + 's',
        },
        handler: {
          executorType: 'home-reconciler',
        },
      },
    };
    const result = await client.addBlueprintDefinition(definition);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete blueprint definition
app.delete('/api/definitions/:name', async (req, res) => {
  try {
    client.setPrivateKey(config.colonyPrvKey);
    await client.removeBlueprintDefinition(config.colonyName, req.params.name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: List all blueprints (devices)
app.get('/api/devices', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);
    const blueprints = await client.getBlueprints(config.colonyName);
    res.json(blueprints || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get a specific device
app.get('/api/devices/:name', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);
    const blueprint = await client.getBlueprint(config.colonyName, req.params.name);
    res.json(blueprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Create a new device (blueprint)
app.post('/api/devices', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);
    const blueprint = {
      kind: req.body.kind,
      metadata: {
        name: req.body.name,
        colonyname: config.colonyName,
      },
      handler: {
        executortype: req.body.executorType || 'home-reconciler',
      },
      spec: req.body.spec || {},
    };
    const result = await client.addBlueprint(blueprint);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update device spec (desired state)
app.put('/api/devices/:name/spec', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);

    // Get current blueprint
    const current = await client.getBlueprint(config.colonyName, req.params.name);

    // Update spec
    current.spec = { ...current.spec, ...req.body };

    const result = await client.updateBlueprint(current);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete a device
app.delete('/api/devices/:name', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);
    await client.removeBlueprint(config.colonyName, req.params.name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Trigger reconciliation
app.post('/api/devices/:name/reconcile', async (req, res) => {
  try {
    client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);
    const result = await client.reconcileBlueprint(config.colonyName, req.params.name, req.body.force || false);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`Home Automation Web UI running at http://localhost:${config.port}`);
  console.log(`Connected to ColonyOS at ${config.colonies.host}:${config.colonies.port}`);
  console.log(`Colony: ${config.colonyName}`);
});
