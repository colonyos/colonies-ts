/**
 * Setup Script
 *
 * Creates the HomeDevice blueprint definition and sample devices.
 *
 * Usage: npm run setup
 */

import { ColoniesClient } from 'colonies-ts';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment
const config = {
  colonies: {
    host: process.env.COLONIES_SERVER_HOST || 'localhost',
    port: parseInt(process.env.COLONIES_SERVER_HTTP_PORT || process.env.COLONIES_SERVER_PORT || '50080', 10),
    tls: (process.env.COLONIES_SERVER_HTTP_TLS ?? process.env.COLONIES_SERVER_TLS ?? 'false') === 'true',
  },
  colonyName: process.env.COLONIES_COLONY_NAME || 'dev',
  colonyPrvKey: process.env.COLONIES_COLONY_PRVKEY,
  executorPrvKey: process.env.COLONIES_PRVKEY,
};

if (!config.colonyPrvKey) {
  console.error('Error: COLONIES_COLONY_PRVKEY environment variable is required');
  console.error('Run: source /path/to/colonies/docker-compose.env');
  process.exit(1);
}

const client = new ColoniesClient(config.colonies);

async function setupDefinition() {
  console.log('\n--- Setting up Blueprint Definition ---\n');
  client.setPrivateKey(config.colonyPrvKey);

  const defPath = join(__dirname, 'home-device-def.json');
  const definition = JSON.parse(readFileSync(defPath, 'utf-8'));

  // Override colonyname
  definition.metadata.colonyname = config.colonyName;

  try {
    await client.addBlueprintDefinition(definition);
    console.log(`  Created: ${definition.metadata.name} (kind: ${definition.kind})`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`  Exists: ${definition.metadata.name}`);
    } else {
      console.error(`  Failed: ${error.message}`);
    }
  }
}

async function setupBlueprints() {
  console.log('\n--- Setting up Sample Devices ---\n');
  client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);

  const bpDir = join(__dirname, 'blueprints');
  const files = readdirSync(bpDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const bp = JSON.parse(readFileSync(join(bpDir, file), 'utf-8'));
    bp.metadata.colonyname = config.colonyName;

    try {
      await client.addBlueprint(bp);
      console.log(`  Created: ${bp.metadata.name} (${bp.spec.deviceType})`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  Exists: ${bp.metadata.name}`);
      } else {
        console.error(`  Failed: ${bp.metadata.name} - ${error.message}`);
      }
    }
  }
}

async function listDevices() {
  console.log('\n--- Current Devices ---\n');
  client.setPrivateKey(config.executorPrvKey || config.colonyPrvKey);

  const blueprints = await client.getBlueprints(config.colonyName);

  if (!blueprints || blueprints.length === 0) {
    console.log('  No devices found');
    return;
  }

  for (const bp of blueprints) {
    const spec = bp.spec || {};
    const status = bp.status || {};
    const synced = Object.keys(status).length > 0 ?
      (JSON.stringify(spec) === JSON.stringify(status) ? 'synced' : 'out-of-sync') : 'no status';

    console.log(`  ${bp.metadata?.name}`);
    console.log(`    Type: ${spec.deviceType || 'unknown'}, Room: ${spec.room || 'none'}`);
    console.log(`    State: ${synced}`);
    console.log();
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Home Automation Setup');
  console.log('='.repeat(50));
  console.log(`Colony: ${config.colonyName}`);
  console.log(`Server: ${config.colonies.host}:${config.colonies.port}`);

  await setupDefinition();
  await setupBlueprints();
  await listDevices();

  console.log('='.repeat(50));
  console.log('Setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Start the web UI: npm start');
  console.log('  2. Start the reconciler: npm run reconciler');
  console.log('  3. Open http://localhost:3000');
  console.log('='.repeat(50) + '\n');
}

main().catch(error => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});
