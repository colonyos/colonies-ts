/**
 * Home Automation Reconciler
 *
 * A simple reconciler that:
 * 1. Registers as an executor
 * 2. Hosts a WebSocket server for real-time UI updates
 * 3. Assigns reconcile processes
 * 4. Reads the blueprint spec (desired state)
 * 5. Simulates applying changes to the device
 * 6. Updates the blueprint status (current state)
 * 7. Broadcasts state changes to connected UI clients
 *
 * Usage: npm run reconciler
 */

import { ColoniesClient, Crypto } from 'colonies-ts';
import { WebSocketServer } from 'ws';

// Configuration from environment
const config = {
  colonies: {
    host: process.env.COLONIES_SERVER_HOST || 'localhost',
    port: parseInt(process.env.COLONIES_SERVER_HTTP_PORT || process.env.COLONIES_SERVER_PORT || '50080', 10),
    tls: (process.env.COLONIES_SERVER_HTTP_TLS ?? process.env.COLONIES_SERVER_TLS ?? 'false') === 'true',
  },
  wsPort: parseInt(process.env.RECONCILER_WS_PORT || '3001', 10),
  colonyName: process.env.COLONIES_COLONY_NAME || 'dev',
  colonyPrvKey: process.env.COLONIES_COLONY_PRVKEY,
  executorPrvKey: process.env.COLONIES_PRVKEY,
  executorId: process.env.COLONIES_EXECUTOR_ID,
};

if (!config.executorPrvKey) {
  console.error('Error: COLONIES_PRVKEY environment variable is required');
  console.error('Run: source /path/to/colonies/docker-compose.env');
  process.exit(1);
}

const client = new ColoniesClient(config.colonies);
const crypto = new Crypto();

// Simulated device states (in-memory)
const deviceStates = new Map();

// WebSocket server for real-time UI updates
const wss = new WebSocketServer({ port: config.wsPort });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`UI client connected (${clients.size} total)`);

  // Send current state to new client
  const allStates = {};
  for (const [name, state] of deviceStates) {
    allStates[name] = state;
  }
  ws.send(JSON.stringify({ type: 'init', devices: allStates }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`UI client disconnected (${clients.size} total)`);
  });
});

function broadcastDeviceUpdate(deviceName, status) {
  const message = JSON.stringify({
    type: 'update',
    device: deviceName,
    status: status,
  });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

async function registerExecutor() {
  console.log('Registering reconciler executor...');

  const executorId = config.executorId || crypto.id(config.executorPrvKey);

  // Check if executor already exists
  client.setPrivateKey(config.executorPrvKey);
  try {
    const executor = await client.getExecutor(config.colonyName, 'home-reconciler');
    console.log('Executor already registered:', executor.executorname);
    return;
  } catch {
    // Executor doesn't exist, create it
  }

  // Register new executor (requires colony owner key)
  client.setPrivateKey(config.colonyPrvKey);
  try {
    await client.addExecutor({
      executorname: 'home-reconciler',
      executortype: 'home-reconciler',
      colonyname: config.colonyName,
      executorId: executorId,
    });
    await client.approveExecutor(config.colonyName, 'home-reconciler');
    console.log('Executor registered and approved');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.error('Failed to register executor:', error.message);
    }
  }
}

async function simulateDevice(deviceName, spec) {
  // Simulate a short delay for "applying" changes
  await new Promise(resolve => setTimeout(resolve, 500));

  // In a real system, this would communicate with actual hardware
  // For simulation, we just copy the spec to status
  const newStatus = {
    ...spec,
    lastUpdated: new Date().toISOString(),
    online: true,
  };

  deviceStates.set(deviceName, newStatus);

  // Broadcast update to connected UI clients
  broadcastDeviceUpdate(deviceName, newStatus);

  return newStatus;
}

async function reconcileSingleBlueprint(blueprintName) {
  console.log(`  Reconciling device: ${blueprintName}`);

  // Get the blueprint
  const blueprint = await client.getBlueprint(config.colonyName, blueprintName);
  const spec = blueprint.spec || {};

  console.log(`    Desired state:`, JSON.stringify(spec));

  // Simulate applying to device
  const newStatus = await simulateDevice(blueprintName, spec);

  console.log(`    Applied state:`, JSON.stringify(newStatus));

  // Update blueprint status
  await client.updateBlueprintStatus(config.colonyName, blueprintName, newStatus);
  console.log(`    Done`);
}

async function handleReconcileProcess(process) {
  // Check for specific blueprint (explicit reconcile API) or kind-based (cron/batch)
  const blueprintName = process.spec?.kwargs?.blueprintName;
  const kind = process.spec?.kwargs?.kind;

  try {
    if (blueprintName) {
      // Specific blueprint reconciliation
      await reconcileSingleBlueprint(blueprintName);
      await client.closeProcess(process.processid, [`Reconciled ${blueprintName} successfully`]);
    } else if (kind) {
      // Kind-based reconciliation - reconcile all blueprints of this kind
      console.log(`  Reconciling all blueprints of kind: ${kind}`);
      const blueprints = await client.getBlueprints(config.colonyName, kind);

      if (!blueprints || blueprints.length === 0) {
        console.log(`    No blueprints found for kind: ${kind}`);
        await client.closeProcess(process.processid, [`No blueprints found for kind: ${kind}`]);
        return;
      }

      console.log(`    Found ${blueprints.length} blueprint(s)`);
      const results = [];
      for (const bp of blueprints) {
        try {
          await reconcileSingleBlueprint(bp.metadata.name);
          results.push(`${bp.metadata.name}: OK`);
        } catch (error) {
          results.push(`${bp.metadata.name}: ${error.message}`);
        }
      }
      await client.closeProcess(process.processid, results);
    } else {
      console.log('  No blueprintName or kind in kwargs:', JSON.stringify(process.spec?.kwargs));
      await client.failProcess(process.processid, ['No blueprint name or kind provided']);
    }
  } catch (error) {
    console.error(`    Failed: ${error.message}`);
    await client.failProcess(process.processid, [error.message]);
  }
}

async function reconcileLoop() {
  console.log('\nWaiting for reconcile processes...\n');

  while (true) {
    try {
      client.setPrivateKey(config.executorPrvKey);

      // Try to assign a process (with 10 second timeout)
      const process = await client.assign(config.colonyName, 10, config.executorPrvKey);

      if (process) {
        console.log(`Assigned process: ${process.processid}`);
        console.log(`  Function: ${process.spec?.funcname}`);

        if (process.spec?.funcname === 'reconcile' || process.spec?.funcname === 'cleanup') {
          await handleReconcileProcess(process);
        } else {
          console.log(`  Unknown function, closing`);
          await client.closeProcess(process.processid, ['Unknown function']);
        }
      }
    } catch (error) {
      // Timeout and "no process available" are expected when idle
      const isExpected = error.message.includes('timeout') ||
                         error.message.includes('No process available');
      if (!isExpected) {
        console.error('Error in reconcile loop:', error.message);
      }
    }
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Home Automation Reconciler');
  console.log('='.repeat(50));
  console.log(`Colony: ${config.colonyName}`);
  console.log(`Server: ${config.colonies.host}:${config.colonies.port}`);
  console.log(`WebSocket: ws://0.0.0.0:${config.wsPort}`);

  await registerExecutor();
  await reconcileLoop();
}

main().catch(error => {
  console.error('Reconciler failed:', error.message);
  process.exit(1);
});
