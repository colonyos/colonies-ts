#!/usr/bin/env node
/**
 * Home Automation Reconciler Example
 *
 * A simple reconciler that manages home devices (lights, thermostats, etc.)
 * using the ColoniesOS blueprint system.
 *
 * The reconciler:
 * 1. Waits for reconcile processes
 * 2. Reads the blueprint spec (desired state)
 * 3. Simulates applying changes to the device
 * 4. Updates the blueprint status (current state)
 *
 * Usage:
 *   # Set environment variables
 *   export COLONIES_SERVER_HOST=localhost
 *   export COLONIES_SERVER_PORT=50080
 *   export COLONIES_COLONY_NAME=dev
 *   export COLONIES_PRVKEY=<your-executor-private-key>
 *
 *   # Run the reconciler
 *   node examples/home-reconciler.js
 */

// Import the ColoniesClient from the library
// When using the npm package: import { ColoniesClient, Crypto } from 'colonies-ts';
const { ColoniesClient, Crypto } = require('../dist/index.js');

// Configuration from environment variables
const config = {
  host: process.env.COLONIES_SERVER_HOST || 'localhost',
  port: parseInt(process.env.COLONIES_SERVER_PORT || '50080', 10),
  tls: process.env.COLONIES_SERVER_TLS === 'true',
  colonyName: process.env.COLONIES_COLONY_NAME || 'dev',
  executorPrvKey: process.env.COLONIES_PRVKEY,
  executorType: 'home-reconciler',
  executorName: process.env.COLONIES_EXECUTOR_NAME || 'home-reconciler-1',
};

// Validate configuration
if (!config.executorPrvKey) {
  console.error('Error: COLONIES_PRVKEY environment variable is required');
  process.exit(1);
}

// Initialize client and crypto
const client = new ColoniesClient({
  host: config.host,
  port: config.port,
  tls: config.tls,
});
const crypto = new Crypto();

// Simulated device states (in a real implementation, this would be actual device connections)
const deviceStates = new Map();

/**
 * Simulate applying changes to a device
 * In a real implementation, this would communicate with actual hardware
 */
function applyToDevice(deviceName, spec) {
  console.log(`Applying to device "${deviceName}":`, JSON.stringify(spec, null, 2));

  // Simulate device response time
  const currentState = {
    ...spec,
    lastSeen: new Date().toISOString(),
    online: true,
  };

  deviceStates.set(deviceName, currentState);
  return currentState;
}

/**
 * Process a reconcile request
 */
async function handleReconcile(process) {
  const processId = process.processid;
  const blueprintName = process.spec?.kwargs?.blueprintname;
  const force = process.spec?.kwargs?.force || false;

  console.log(`\nReconciling blueprint: ${blueprintName} (force: ${force})`);

  try {
    // Get the blueprint to read the spec (desired state)
    const blueprint = await client.getBlueprint(config.colonyName, blueprintName);

    if (!blueprint) {
      throw new Error(`Blueprint not found: ${blueprintName}`);
    }

    console.log('Blueprint kind:', blueprint.kind);
    console.log('Desired state (spec):', JSON.stringify(blueprint.spec, null, 2));
    console.log('Current state (status):', JSON.stringify(blueprint.status, null, 2));

    // Compare spec and status to determine if changes are needed
    const specStr = JSON.stringify(blueprint.spec || {});
    const statusStr = JSON.stringify(blueprint.status || {});
    const changesNeeded = force || specStr !== statusStr;

    if (!changesNeeded) {
      console.log('No changes needed - spec matches status');
      await client.closeProcess(processId, ['No changes needed']);
      return;
    }

    // Apply the desired state to the device
    console.log('Applying changes to device...');
    const newStatus = applyToDevice(blueprintName, blueprint.spec);

    // Update the blueprint status with the new current state
    await client.updateBlueprintStatus(config.colonyName, blueprintName, newStatus);
    console.log('Updated blueprint status:', JSON.stringify(newStatus, null, 2));

    // Close the process successfully
    await client.closeProcess(processId, ['Reconciled successfully']);
    console.log('Reconcile complete');

  } catch (error) {
    console.error('Reconcile error:', error.message);
    await client.failProcess(processId, [error.message]);
  }
}

/**
 * Register the executor with the colony
 */
async function registerExecutor() {
  client.setPrivateKey(config.executorPrvKey);
  const executorId = crypto.id(config.executorPrvKey);

  console.log('Executor ID:', executorId);
  console.log('Executor Type:', config.executorType);

  try {
    // Try to add the executor (will fail if already exists)
    await client.addExecutor({
      executorid: executorId,
      executortype: config.executorType,
      executorname: config.executorName,
      colonyname: config.colonyName,
    });
    console.log('Executor registered');

    // Approve the executor (requires colony owner key, skip in demo)
    console.log('Note: Executor needs to be approved by colony owner');
  } catch (error) {
    // Executor might already exist
    console.log('Executor registration:', error.message);
  }
}

/**
 * Main reconciler loop
 */
async function main() {
  console.log('Home Automation Reconciler');
  console.log('==========================');
  console.log(`Server: ${config.host}:${config.port} (TLS: ${config.tls})`);
  console.log(`Colony: ${config.colonyName}`);
  console.log(`Executor: ${config.executorName} (type: ${config.executorType})`);
  console.log('');

  // Register executor
  await registerExecutor();

  console.log('\nWaiting for reconcile processes...');
  console.log('Press Ctrl+C to stop\n');

  // Main loop - wait for and process reconcile requests
  while (true) {
    try {
      // Wait for a process to be assigned (10 second timeout)
      const process = await client.assign(config.colonyName, 10, config.executorPrvKey);

      if (process) {
        console.log(`\nAssigned process: ${process.processid}`);
        console.log(`Function: ${process.spec?.funcname}`);

        // Handle different function types
        switch (process.spec?.funcname) {
          case 'reconcile':
            await handleReconcile(process);
            break;
          case 'cleanup':
            // Handle cleanup if needed
            console.log('Cleanup requested');
            await client.closeProcess(process.processid, ['Cleanup complete']);
            break;
          default:
            console.log(`Unknown function: ${process.spec?.funcname}`);
            await client.failProcess(process.processid, [`Unknown function: ${process.spec?.funcname}`]);
        }
      }
    } catch (error) {
      // Timeout or other error - continue waiting
      if (!error.message.includes('timeout') && !error.message.includes('No waiting')) {
        console.error('Error:', error.message);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

// Run the reconciler
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
