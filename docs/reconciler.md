# Building a Home Automation Reconciler

This tutorial shows how to build a simple reconciler using the ColoniesOS blueprint system. A reconciler watches for desired state changes and applies them to actual devices or systems.

## What is a Reconciler?

A reconciler implements the "desired state" pattern:
1. Users set the desired state (spec) in a blueprint
2. The reconciler reads the desired state
3. The reconciler applies changes to make actual state match desired state
4. The reconciler updates the blueprint status with actual state

This pattern is used in systems like Kubernetes, Terraform, and infrastructure-as-code tools.

## Blueprint Structure

A blueprint has two key sections:
- **spec**: The desired state (what you want)
- **status**: The current state (what you have)

```json
{
  "kind": "HomeDevice",
  "metadata": {
    "name": "living-room-light",
    "colonyname": "dev"
  },
  "handler": {
    "executortype": "home-reconciler"
  },
  "spec": {
    "power": true,
    "brightness": 80
  },
  "status": {
    "power": false,
    "brightness": 0,
    "lastSeen": "2024-01-01T12:00:00Z"
  }
}
```

## Step 1: Create a Blueprint Definition

First, define the blueprint type:

```bash
# Create blueprint definition
cat > home-device-def.json << 'EOF'
{
  "kind": "HomeDevice",
  "metadata": {
    "name": "home-device-def",
    "colonyname": "dev"
  }
}
EOF

colonies blueprintdef add --spec home-device-def.json
```

## Step 2: Create a Device Blueprint

Add a blueprint for a specific device:

```bash
# Create a light blueprint
cat > living-room-light.json << 'EOF'
{
  "kind": "HomeDevice",
  "metadata": {
    "name": "living-room-light",
    "colonyname": "dev"
  },
  "handler": {
    "executortype": "home-reconciler"
  },
  "spec": {
    "deviceType": "light",
    "power": true,
    "brightness": 80
  }
}
EOF

colonies blueprint add --spec living-room-light.json
```

## Step 3: Set Desired State via CLI

Update the desired state using the CLI:

```bash
# Turn off the light
colonies blueprint set --name living-room-light --key spec.power --value false

# Set brightness to 50%
colonies blueprint set --name living-room-light --key spec.brightness --value 50

# Check the blueprint
colonies blueprint get --name living-room-light
```

## Step 4: Implement the Reconciler

The reconciler is an executor that:
1. Waits for reconcile processes
2. Reads the blueprint spec
3. Applies changes to the device
4. Updates the blueprint status

See `examples/home-reconciler.js` for a complete implementation:

```javascript
const { ColoniesClient, Crypto } = require('colonies-ts');

const client = new ColoniesClient({
  host: process.env.COLONIES_SERVER_HOST || 'localhost',
  port: parseInt(process.env.COLONIES_SERVER_PORT || '50080', 10),
  tls: process.env.COLONIES_SERVER_TLS === 'true',
});

async function handleReconcile(process) {
  const blueprintName = process.spec?.kwargs?.blueprintname;

  // Get the blueprint
  const blueprint = await client.getBlueprint(colonyName, blueprintName);

  // Apply desired state to device
  const newStatus = applyToDevice(blueprintName, blueprint.spec);

  // Update blueprint status
  await client.updateBlueprintStatus(colonyName, blueprintName, newStatus);

  // Close the process
  await client.closeProcess(process.processid, ['Reconciled successfully']);
}
```

## Step 5: Run the Reconciler

```bash
# Set environment variables
export COLONIES_SERVER_HOST=localhost
export COLONIES_SERVER_PORT=50080
export COLONIES_COLONY_NAME=dev
export COLONIES_PRVKEY=<your-executor-private-key>

# Run the reconciler
node examples/home-reconciler.js
```

## Step 6: Trigger Reconciliation

Reconciliation happens automatically when the blueprint spec changes. You can also trigger it manually:

```bash
# Normal reconcile (only if changes detected)
colonies blueprint reconcile --name living-room-light

# Force reconcile (always runs)
colonies blueprint reconcile --name living-room-light --force
```

## Using the TypeScript API

You can also manage blueprints programmatically:

```typescript
import { ColoniesClient } from 'colonies-ts';

const client = new ColoniesClient({
  host: 'localhost',
  port: 50080,
});
client.setPrivateKey(process.env.COLONIES_PRVKEY);

// Add a blueprint
await client.addBlueprint({
  kind: 'HomeDevice',
  metadata: {
    name: 'bedroom-thermostat',
    colonyname: 'dev',
  },
  handler: {
    executortype: 'home-reconciler',
  },
  spec: {
    deviceType: 'thermostat',
    temperature: 22,
    mode: 'heat',
  },
});

// Update desired state
const blueprint = await client.getBlueprint('dev', 'bedroom-thermostat');
blueprint.spec.temperature = 20;
await client.updateBlueprint(blueprint);

// Trigger reconciliation
await client.reconcileBlueprint('dev', 'bedroom-thermostat');

// Check current state
const updated = await client.getBlueprint('dev', 'bedroom-thermostat');
console.log('Current temperature:', updated.status?.temperature);
```

## Blueprint API Reference

### Blueprint Definitions

```typescript
// Add a blueprint definition
await client.addBlueprintDefinition(definition);

// Get a definition
const def = await client.getBlueprintDefinition(colonyName, name);

// List all definitions
const defs = await client.getBlueprintDefinitions(colonyName);

// Remove a definition
await client.removeBlueprintDefinition(colonyName, name);
```

### Blueprints

```typescript
// Add a blueprint
await client.addBlueprint(blueprint);

// Get a blueprint
const bp = await client.getBlueprint(colonyName, name);

// List blueprints (with optional filters)
const bps = await client.getBlueprints(colonyName, kind?, location?);

// Update a blueprint
await client.updateBlueprint(blueprint, forceGeneration?);

// Update status only
await client.updateBlueprintStatus(colonyName, name, status);

// Trigger reconciliation
await client.reconcileBlueprint(colonyName, name, force?);

// Remove a blueprint
await client.removeBlueprint(colonyName, name);
```

## Best Practices

1. **Idempotent reconciliation**: The reconciler should be safe to run multiple times
2. **Status updates**: Always update status after applying changes
3. **Error handling**: Use `failProcess` for errors, include meaningful messages
4. **Logging**: Log reconciliation actions for debugging
5. **Timeouts**: Handle device communication timeouts gracefully

## Next Steps

- See `examples/home-reconciler.js` for a complete working example
- Read about [channels](channels.md) for real-time communication
- Check the [API reference](api-reference.md) for all available methods
