# ColonyOS TypeScript/Javascript Client Library

[![CI](https://github.com/colonyos/colonies-ts/actions/workflows/node.yml/badge.svg)](https://github.com/colonyos/colonies-ts/actions/workflows/node.yml)
[![codecov](https://img.shields.io/codecov/c/github/colonyos/colonies-ts)](https://codecov.io/gh/colonyos/colonies-ts)
[![npm version](https://badge.fury.io/js/colonies-ts.svg)](https://www.npmjs.com/package/colonies-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript client library for ColonyOS - a distributed meta-orchestrator for compute continuums.

## Installation

```bash
npm install colonies-ts
```

## Three Execution Patterns

ColonyOS supports three patterns for distributed task execution:

### 1. Batch Processing

Traditional request-response pattern for discrete tasks. Submit a job, an executor picks it up, processes it, and returns the result.

```mermaid
sequenceDiagram
    participant Client
    participant Colonies Server
    participant Executor

    Client->>Colonies Server: submitFunctionSpec()
    Colonies Server-->>Client: Process (WAITING)
    Client->>Colonies Server: subscribeProcess(SUCCESS)

    Executor->>Colonies Server: assign()
    Colonies Server-->>Executor: Process (RUNNING)

    Note over Executor: Execute task

    Executor->>Colonies Server: closeProcess(output)
    Colonies Server-->>Client: Process (SUCCESS)
```

```typescript
// Submit a batch job
const process = await client.submitFunctionSpec({
  funcname: 'process-image',
  kwargs: { imageUrl: 'https://example.com/image.jpg' },
  conditions: {
    colonyname: 'my-colony',
    executortype: 'image-processor',
  },
  maxexectime: 300,
});

// Subscribe to process completion
client.subscribeProcess(
  'my-colony', process.processid, ProcessState.SUCCESS, 300,
  (result) => console.log('Output:', result.output),
  console.error,
  () => {}
);
```

### 2. Blueprint Reconciliation

Declarative desired-state pattern for managing resources. Define the desired state in a blueprint, and a reconciler continuously ensures the actual state matches.

```mermaid
sequenceDiagram
    participant User
    participant Colonies Server
    participant Reconciler
    participant Device

    User->>Colonies Server: updateBlueprint(spec)
    Note over Colonies Server: Generation++

    Colonies Server->>Colonies Server: Create reconcile process
    Reconciler->>Colonies Server: assign()
    Colonies Server-->>Reconciler: Process (RUNNING)

    Reconciler->>Colonies Server: getBlueprint()
    Colonies Server-->>Reconciler: spec + status

    Reconciler->>Device: Apply changes
    Device-->>Reconciler: Current state

    Reconciler->>Colonies Server: updateBlueprintStatus()
    Reconciler->>Colonies Server: closeProcess()
    Note over Colonies Server: spec == status
```

```typescript
// Create a blueprint with desired state
await client.addBlueprint({
  kind: 'HomeDevice',
  metadata: { name: 'living-room-light', colonyname: 'home' },
  handler: { executortype: 'home-reconciler' },
  spec: { power: true, brightness: 80 },  // Desired state
});

// Update desired state - reconciler will sync
const bp = await client.getBlueprint('home', 'living-room-light');
bp.spec.brightness = 50;
await client.updateBlueprint(bp);

// Or via CLI: colonies blueprint set --name living-room-light --key spec.brightness --value 50
```

### 3. Real-time Channels

Bidirectional streaming for interactive workloads like chat, live data, or long-running processes with progress updates.

```mermaid
sequenceDiagram
    participant Client
    participant Colonies Server
    participant Executor

    Client->>Colonies Server: submitFunctionSpec(channels)
    Colonies Server-->>Client: Process (WAITING)
    Client->>Colonies Server: subscribeProcess(RUNNING)

    Executor->>Colonies Server: assign()
    Colonies Server-->>Executor: Process (RUNNING)
    Colonies Server-->>Client: Process (RUNNING)

    Client->>Colonies Server: subscribeChannel()
    Note over Client,Executor: WebSocket streams open

    Client->>Colonies Server: channelAppend("prompt")
    Colonies Server-->>Executor: Message

    loop Streaming response
        Executor->>Colonies Server: channelAppend("token")
        Colonies Server-->>Client: Message
    end

    Executor->>Colonies Server: closeProcess()
```

```typescript
// Submit process with channel
const process = await client.submitFunctionSpec({
  funcname: 'chat',
  kwargs: { model: 'llama3' },
  conditions: { colonyname: 'ai', executortype: 'llm' },
  channels: ['chat'],
});

// Wait for process to be assigned, then subscribe to channel
client.subscribeProcess(
  'ai', process.processid, ProcessState.RUNNING, 60,
  (runningProcess) => {
    // Now subscribe to channel for streaming
    client.subscribeChannel(
      runningProcess.processid, 'chat', 0, 300,
      (entries) => entries.forEach(e => console.log(e.payload)),
      console.error,
      () => {}
    );
    // Send message
    client.channelAppend(runningProcess.processid, 'chat', 1, 0, 'Hello!');
  },
  console.error,
  () => {}
);
```

## Crypto

The library includes a self-contained secp256k1 ECDSA implementation:

```typescript
import { Crypto } from 'colonies-ts';

const crypto = new Crypto();

// Generate a new private key
const privateKey = crypto.generatePrivateKey();

// Derive the public ID from a private key
const id = crypto.id(privateKey);

// Sign a message
const signature = crypto.sign('message', privateKey);
```

## Examples

- [Home Automation](examples/blueprint/) - Complete web app for managing smart home devices using blueprints

## Documentation

- [Getting Started](docs/getting-started.md) - Introduction to ColonyOS and basic usage
- [Using Channels](docs/channels.md) - Real-time messaging between clients and executors
- [Building Reconcilers](docs/reconciler.md) - Blueprint and reconciler tutorial
- [API Reference](docs/api-reference.md) - Complete API documentation

## Development

### Prerequisites

- Node.js >= 18
- npm

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test                 # Unit tests
npm run test:integration # Integration tests (requires running server)
npm run test:all         # All tests
```

Integration tests require a running ColonyOS server:

```bash
cd /path/to/colonies
docker-compose up -d
```

### Build

```bash
npm run build
```

This generates ESM and CommonJS builds in the `dist/` directory.

## API Reference

### ColoniesClient

```typescript
new ColoniesClient({
  host: string,      // Server hostname
  port: number,      // Server port
  tls?: boolean,     // Enable TLS (default: false)
})
```

#### Colony & Server

| Method | Description |
|--------|-------------|
| `setPrivateKey(key)` | Set the private key for signing requests |
| `getColonies()` | List all colonies |
| `getStatistics()` | Get server statistics |
| `addColony(colony)` | Add a new colony |
| `removeColony(colonyName)` | Remove a colony |

#### Executors

| Method | Description |
|--------|-------------|
| `getExecutors(colonyName)` | List executors in a colony |
| `getExecutor(colonyName, executorName)` | Get a specific executor |
| `addExecutor(executor)` | Register a new executor |
| `approveExecutor(colonyName, executorName)` | Approve an executor |
| `removeExecutor(colonyName, executorName)` | Remove an executor |

#### Processes

| Method | Description |
|--------|-------------|
| `submitFunctionSpec(spec)` | Submit a process |
| `assign(colonyName, timeout, prvKey)` | Assign a process to execute |
| `getProcess(processId)` | Get process details |
| `getProcesses(colonyName, count, state)` | List processes by state |
| `closeProcess(processId, output)` | Close a process successfully |
| `failProcess(processId, errors)` | Close a process with failure |
| `removeProcess(processId)` | Remove a process |
| `removeAllProcesses(colonyName, state)` | Remove all processes |

#### Workflows

| Method | Description |
|--------|-------------|
| `submitWorkflowSpec(spec)` | Submit a workflow (DAG) |
| `getProcessGraph(graphId)` | Get workflow details |
| `getProcessGraphs(colonyName, count, state?)` | List workflows |
| `removeProcessGraph(graphId)` | Remove a workflow |
| `removeAllProcessGraphs(colonyName, state?)` | Remove all workflows |

#### Channels

| Method | Description |
|--------|-------------|
| `channelAppend(processId, channelName, seq, inReplyTo, payload)` | Send message to channel |
| `channelRead(processId, channelName, afterSeq, limit)` | Read messages from channel |
| `subscribeChannel(...)` | Subscribe to channel via WebSocket |
| `subscribeProcess(...)` | Subscribe to process state changes |

#### Blueprints

| Method | Description |
|--------|-------------|
| `addBlueprintDefinition(definition)` | Add a blueprint definition |
| `getBlueprintDefinition(colonyName, name)` | Get a blueprint definition |
| `getBlueprintDefinitions(colonyName)` | List blueprint definitions |
| `removeBlueprintDefinition(colonyName, name)` | Remove a blueprint definition |
| `addBlueprint(blueprint)` | Add a blueprint |
| `getBlueprint(colonyName, name)` | Get a blueprint |
| `getBlueprints(colonyName, kind?, location?)` | List blueprints |
| `updateBlueprint(blueprint, forceGeneration?)` | Update a blueprint |
| `removeBlueprint(colonyName, name)` | Remove a blueprint |
| `updateBlueprintStatus(colonyName, name, status)` | Update blueprint status |
| `reconcileBlueprint(colonyName, name, force?)` | Trigger reconciliation |

#### Crons & Generators

| Method | Description |
|--------|-------------|
| `getCrons(colonyName)` | List cron jobs |
| `getCron(cronId)` | Get a cron job |
| `addCron(cronSpec)` | Add a cron job |
| `removeCron(cronId)` | Remove a cron job |
| `getGenerators(colonyName)` | List generators |
| `getGenerator(generatorId)` | Get a generator |
| `addGenerator(generatorSpec)` | Add a generator |

### ProcessState

```typescript
enum ProcessState {
  WAITING = 0,
  RUNNING = 1,
  SUCCESS = 2,
  FAILED = 3,
}
```

## License

MIT
