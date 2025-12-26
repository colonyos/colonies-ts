# Home Automation Example

A complete home automation web app using ColonyOS blueprints for managing smart devices.

## Architecture

```mermaid
flowchart LR
    subgraph Browser[Web Browser]
        App[app.js]
        SDK[colonies-ts SDK]
        App --> SDK
    end

    subgraph Static[Static Server :3000]
        Express[Node.js Express]
        Files[HTML/JS/CSS]
        Express --> Files
    end

    subgraph ColonyOS[ColonyOS Server :50080]
        Server[Colonies API]
        Blueprints[(Blueprints)]
        Processes[(Processes)]
        Server --> Blueprints
        Server --> Processes
    end

    subgraph Reconciler[Reconciler :46701]
        Executor[home-reconciler]
        WS[WebSocket]
        Devices[Simulated Devices]
        Executor --> Devices
    end

    Browser -->|fetch static files| Static
    SDK <-->|HTTP API| Server
    Browser <-.->|WebSocket| WS
    Executor <-->|assign/close| Server
    WS -.->|status updates| Browser
```

### Direct SDK Access

The browser uses the **colonies-ts SDK directly** to communicate with ColonyOS:

- **No API proxy** - Browser talks directly to ColonyOS server via SDK
- **Static file server** - Express only serves HTML, JS, and CSS
- **Real-time updates** - Browser connects to reconciler WebSocket on port 46701

This is possible because:
1. ColonyOS server has CORS enabled (`Access-Control-Allow-Origin: *`)
2. The SDK is bundled for browser use with esbuild
3. Private keys are passed from server config (demo only - use proper auth in production)

## Reconciliation Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI
    participant Colonies Server
    participant Reconciler
    participant Device

    User->>WebUI: Update device spec (power: true)
    WebUI->>Colonies Server: updateBlueprint(spec)
    Note over Colonies Server: Generation++
    Colonies Server->>Colonies Server: Create reconcile process

    Reconciler->>Colonies Server: assign()
    Colonies Server-->>Reconciler: Process (RUNNING)

    Reconciler->>Colonies Server: getBlueprint()
    Colonies Server-->>Reconciler: Blueprint (spec + status)

    Reconciler->>Device: Apply power: true
    Device-->>Reconciler: OK

    Reconciler->>Colonies Server: updateBlueprintStatus()
    Reconciler->>Colonies Server: closeProcess()

    WebUI->>Colonies Server: getBlueprint()
    Colonies Server-->>WebUI: Blueprint (spec == status)
    WebUI-->>User: Device synced
```

## Prerequisites

- Node.js >= 18
- Running ColonyOS server (via docker-compose)
- Colonies CLI installed (optional, for CLI commands)

## Quick Start

### 1. Start ColonyOS Server

If not already running, start the ColonyOS server:

```bash
cd /path/to/colonies
docker-compose up -d
```

Verify the server is running:

```bash
colonies server check
```

### 2. Source Environment Variables

The environment variables contain the server connection details and private keys:

```bash
cd /path/to/colonies
source docker-compose.env

# Verify environment is loaded
echo $COLONIES_COLONY_NAME
```

### 3. Install Dependencies

Navigate to the example directory and install Node.js dependencies:

```bash
cd /path/to/colonies-ts/examples/blueprint
npm install
```

### 4. Run Setup Script

The setup script creates the HomeDevice definition and sample devices:

```bash
npm run setup
```

Expected output:
```
==================================================
Home Automation Setup
==================================================
Colony: dev
Server: localhost:50080

--- Setting up Blueprint Definition ---

  Created: home-device-def (kind: HomeDevice)

--- Setting up Sample Devices ---

  Created: living-room-light (light)
  Created: bedroom-light (light)
  Created: living-room-thermostat (thermostat)

--- Current Devices ---

  living-room-light
    Type: light, Room: Living Room
    State: no status

==================================================
Setup complete!
==================================================
```

### 5. Start the Web Server

```bash
npm start
```

Expected output:
```
Home Automation Web UI running at http://localhost:3000
Connected to ColonyOS at localhost:50080
Colony: dev
```

### 6. Start the Reconciler

Open a new terminal, source the environment, and start the reconciler:

```bash
cd /path/to/colonies
source docker-compose.env

cd /path/to/colonies-ts/examples/blueprint
npm run reconciler
```

Expected output:
```
==================================================
Home Automation Reconciler
==================================================
Colony: dev
Server: localhost:50080
Registering reconciler executor...
Executor registered and approved

Waiting for reconcile processes...
```

### 7. Open the Web UI

Open http://localhost:3000 in your browser.

## Using the Web UI

### Viewing Devices

The main screen shows all configured devices as cards:
- **Green border**: Device is synced (spec == status)
- **Orange border**: Device is out of sync
- **No border**: No status reported yet

### Controlling a Device

1. Click on a device card to open the control panel
2. Use the toggles and sliders to set desired state
3. Changes are saved automatically to the blueprint spec
4. The reconciler will apply changes and update the status

### Adding a New Device

1. Click "+ Add Device"
2. Enter a unique device name (e.g., "kitchen-light")
3. Select the device type (HomeDevice)
4. Optionally enter a room name
5. Click "Add Device"

### Adding a Device Type

1. Click "+ Add Type"
2. Enter a definition name (e.g., "smart-switch-def")
3. Enter the kind (e.g., "SmartSwitch")
4. Click "Add Type"

### Triggering Reconciliation

1. Open a device control panel
2. Click "Reconcile" to manually trigger reconciliation
3. The reconciler will apply the current spec to the device

## Using the Colonies CLI

You can manage devices entirely from the command line using the `colonies` CLI.

### Blueprint Definition Commands

```bash
# List all blueprint definitions
colonies blueprint definition ls

# Add a new definition
colonies blueprint definition add --spec home-device-def.json

# Get definition details
colonies blueprint definition get --name home-device-def

# Remove a definition
colonies blueprint definition remove --name home-device-def
```

### Blueprint (Device) Commands

```bash
# List all blueprints/devices
colonies blueprint ls

# Add a new device from JSON file
colonies blueprint add --spec blueprints/living-room-light.json

# Get device details (shows spec and status)
colonies blueprint get --name living-room-light

# Remove a device
colonies blueprint remove --name living-room-light
```

### Setting Device State

The `set` command uses dot notation for nested fields:

```bash
# Turn on a light
colonies blueprint set --name bedroom-light --key spec.power --value true

# Turn off a light
colonies blueprint set --name bedroom-light --key spec.power --value false

# Set brightness (0-100)
colonies blueprint set --name bedroom-light --key spec.brightness --value 75

# Set thermostat temperature
colonies blueprint set --name living-room-thermostat --key spec.temperature --value 22

# Change room name
colonies blueprint set --name bedroom-light --key spec.room --value "Master Bedroom"
```

### Triggering Reconciliation

```bash
# Normal reconciliation (only if out of sync)
colonies blueprint reconcile --name bedroom-light

# Force reconciliation (always applies, useful for testing)
colonies blueprint reconcile --name bedroom-light --force
```

### Viewing Logs

```bash
# View reconciler logs
colonies blueprint log --name bedroom-light

# View blueprint history
colonies blueprint history --name bedroom-light
```

### Diagnosing Issues

```bash
# Run diagnostic checks on a blueprint
colonies blueprint doctor --name bedroom-light
```

### Complete Example Workflow

```bash
# 1. Source environment
source /path/to/colonies/docker-compose.env

# 2. Create a new light device
cat > /tmp/kitchen-light.json << 'EOF'
{
  "kind": "HomeDevice",
  "metadata": { "name": "kitchen-light", "colonyname": "dev" },
  "handler": { "executortype": "home-reconciler" },
  "spec": {
    "deviceType": "light",
    "room": "Kitchen",
    "power": false,
    "brightness": 50
  }
}
EOF

colonies blueprint add --spec /tmp/kitchen-light.json

# 3. Turn on the light
colonies blueprint set --name kitchen-light --key spec.power --value true

# 4. Check the status
colonies blueprint get --name kitchen-light

# 5. Set brightness to 80%
colonies blueprint set --name kitchen-light --key spec.brightness --value 80

# 6. Force reconciliation
colonies blueprint reconcile --name kitchen-light --force

# 7. Verify the status matches spec
colonies blueprint get --name kitchen-light
```

## File Structure

```
examples/blueprint/
  home-device-def.json     # Blueprint definition for HomeDevice kind
  blueprints/
    living-room-light.json  # Sample light device
    bedroom-light.json      # Sample light device
    living-room-thermostat.json  # Sample thermostat
  browser-sdk.js           # Entry point for esbuild (bundles SDK for browser)
  server.js                # Express static file server + config endpoint
  reconciler.js            # Device reconciler with WebSocket server
  setup.js                 # Setup script
  public/
    index.html             # Web UI
    app.js                 # Frontend JavaScript (uses SDK directly)
    colonies-sdk.js        # Bundled colonies-ts SDK for browser (generated)
    style.css              # Styles
```

## How It Works

### Blueprint Definition

The `home-device-def.json` defines the HomeDevice kind:

```json
{
  "kind": "HomeDevice",
  "metadata": {
    "name": "home-device-def",
    "colonyname": "dev"
  },
  "spec": {
    "names": {
      "kind": "HomeDevice"
    }
  }
}
```

### Device Blueprint

Each device is a blueprint with:
- **kind**: Must match a definition (HomeDevice)
- **spec**: Desired state (what you want)
- **status**: Current state (reported by reconciler)

Example light:
```json
{
  "kind": "HomeDevice",
  "metadata": { "name": "living-room-light", "colonyname": "dev" },
  "handler": { "executortype": "home-reconciler" },
  "spec": {
    "deviceType": "light",
    "room": "Living Room",
    "power": true,
    "brightness": 80
  }
}
```

### Reconciliation Flow

1. User updates device spec (desired state)
2. ColonyOS creates a reconcile process
3. Reconciler assigns the process
4. Reconciler reads the blueprint spec
5. Reconciler applies changes to the device
6. Reconciler updates the blueprint status
7. UI shows synced state

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COLONIES_SERVER_HOST` | ColonyOS server hostname | localhost |
| `COLONIES_SERVER_PORT` | ColonyOS server port | 50080 |
| `COLONIES_SERVER_TLS` | Enable TLS | false |
| `COLONIES_COLONY_NAME` | Colony name | dev |
| `COLONIES_COLONY_PRVKEY` | Colony owner private key | (required) |
| `COLONIES_PRVKEY` | Executor private key | (required) |
| `WEB_PORT` | Web server port | 3000 |
| `RECONCILER_WS_PORT` | Reconciler WebSocket port | 46701 |

## Troubleshooting

### "fetch failed" Error

This means the setup script cannot connect to the ColonyOS server.

**Check if the server is running:**
```bash
# Check if colonies container is running
docker ps | grep colonies

# Check server logs
docker logs colonies

# Test server connectivity
curl http://localhost:50080/api
```

**Start the server if not running:**
```bash
cd /path/to/colonies
docker-compose up -d
```

**Check environment variables:**
```bash
echo "Host: $COLONIES_SERVER_HOST"
echo "Port: $COLONIES_SERVER_PORT"
```

### "Access denied, not colony owner" Error

You're using the wrong private key. Blueprint definitions require the colony owner key.

**Verify you sourced the correct environment:**
```bash
source /path/to/colonies/docker-compose.env
echo $COLONIES_COLONY_PRVKEY
```

### "BlueprintDefinition for kind 'X' not found" Error

The blueprint definition doesn't exist or has the wrong structure.

**Create the definition first:**
```bash
npm run setup
# or
colonies blueprintdef add --spec home-device-def.json
```

**Verify definition exists:**
```bash
colonies blueprintdef ls
colonies blueprintdef get --name home-device-def
```

### Devices Not Syncing

If devices show "out of sync" but the reconciler is running:

1. Check the reconciler terminal for errors
2. Manually trigger reconciliation:
   ```bash
   colonies blueprint reconcile --name living-room-light
   ```
3. Verify the reconciler is registered:
   ```bash
   colonies executor ls
   ```

### Web UI Not Loading

1. Check if the server is running: `npm start`
2. Verify the port is correct (default: 3000)
3. Check for errors in the terminal
4. Try a different port: `WEB_PORT=3001 npm start`

### Connection Timeout

If using TLS or a remote server:

```bash
export COLONIES_SERVER_HOST=your-server.com
export COLONIES_SERVER_PORT=443
export COLONIES_SERVER_TLS=true
```
