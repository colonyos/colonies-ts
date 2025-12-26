# API Reference

Complete API documentation for the colonies-ts TypeScript client library.

## Table of Contents

- [ColoniesClient](#coloniesclient)
  - [Authentication](#authentication)
  - [Colony Operations](#colony-operations)
  - [Executor Operations](#executor-operations)
  - [Process Operations](#process-operations)
  - [Workflow Operations](#workflow-operations)
  - [Channel Operations](#channel-operations)
  - [Blueprint Definition Operations](#blueprint-definition-operations)
  - [Blueprint Operations](#blueprint-operations)
  - [Logging](#logging)
  - [Cron Jobs](#cron-jobs)
  - [Generators](#generators)
  - [Users](#users)
  - [Files](#files)
  - [Functions](#functions)
  - [Attributes](#attributes)
- [Crypto](#crypto)
- [Types](#types)
- [Enums](#enums)

---

## ColoniesClient

The main client class for interacting with a ColonyOS server.

### Constructor

```typescript
new ColoniesClient(config: ColoniesClientConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `config.host` | `string` | Server hostname |
| `config.port` | `number` | Server port |
| `config.tls` | `boolean` | Enable TLS (default: `false`) |

**Example:**

```typescript
const client = new ColoniesClient({
  host: 'localhost',
  port: 50080,
  tls: false,
});
```

---

### Authentication

#### setPrivateKey

Set the private key used for signing requests.

```typescript
setPrivateKey(privateKey: string): void
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `privateKey` | `string` | Hex-encoded secp256k1 private key |

**Example:**

```typescript
client.setPrivateKey('your-64-character-hex-private-key');
```

---

### Colony Operations

#### getColonies

List all colonies on the server.

```typescript
async getColonies(): Promise<Colony[]>
```

**Returns:** Array of colony objects

**Required Key:** Server private key

**Example:**

```typescript
const colonies = await client.getColonies();
console.log(colonies);
```

---

#### getStatistics

Get server statistics.

```typescript
async getStatistics(): Promise<Statistics>
```

**Returns:** Server statistics object

**Required Key:** Server private key

---

### Executor Operations

#### getExecutors

List all executors in a colony.

```typescript
async getExecutors(colonyName: string): Promise<Executor[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |

**Returns:** Array of executor objects

**Example:**

```typescript
const executors = await client.getExecutors('my-colony');
```

---

#### getExecutor

Get a specific executor by name.

```typescript
async getExecutor(colonyName: string, executorName: string): Promise<Executor>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `executorName` | `string` | Name of the executor |

---

#### addExecutor

Register a new executor.

```typescript
async addExecutor(executor: {
  executorid: string;
  executortype: string;
  executorname: string;
  colonyname: string;
}): Promise<Executor>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `executor.executorid` | `string` | Executor's public ID (derived from private key) |
| `executor.executortype` | `string` | Type of executor (for process matching) |
| `executor.executorname` | `string` | Human-readable name |
| `executor.colonyname` | `string` | Colony to join |

**Required Key:** Colony owner private key

**Example:**

```typescript
import { Crypto } from 'colonies-ts';

const crypto = new Crypto();
const executorPrvKey = crypto.generatePrivateKey();
const executorId = crypto.id(executorPrvKey);

await client.addExecutor({
  executorid: executorId,
  executortype: 'worker',
  executorname: 'worker-1',
  colonyname: 'my-colony',
});
```

---

#### approveExecutor

Approve a pending executor.

```typescript
async approveExecutor(colonyName: string, executorName: string): Promise<Executor>
```

**Required Key:** Colony owner private key

---

#### removeExecutor

Remove an executor from a colony.

```typescript
async removeExecutor(colonyName: string, executorName: string): Promise<void>
```

**Required Key:** Colony owner private key

---

### Process Operations

#### submitFunctionSpec

Submit a new process.

```typescript
async submitFunctionSpec(spec: FunctionSpec): Promise<Process>
```

**Parameters:** See [FunctionSpec](#functionspec) type

**Returns:** The created process object

**Example:**

```typescript
const process = await client.submitFunctionSpec({
  funcname: 'compute-task',
  conditions: {
    colonyname: 'my-colony',
    executortype: 'worker',
  },
  maxwaittime: 60,
  maxexectime: 300,
  kwargs: {
    input: 'Hello, World!',
  },
  channels: ['output'],
});
```

---

#### getProcess

Get a process by ID.

```typescript
async getProcess(processId: string): Promise<Process>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID (64-character hex) |

**Returns:** Process object with current state

**Example:**

```typescript
const process = await client.getProcess('abc123...');
console.log('State:', process.state);
console.log('Output:', process.output);
```

---

#### getProcesses

List processes by state.

```typescript
async getProcesses(
  colonyName: string,
  count: number,
  state: ProcessState
): Promise<Process[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `count` | `number` | Maximum number of processes to return |
| `state` | `ProcessState` | Filter by state (0=WAITING, 1=RUNNING, 2=SUCCESS, 3=FAILED) |

**Example:**

```typescript
// Get waiting processes
const waiting = await client.getProcesses('my-colony', 100, ProcessState.WAITING);

// Get completed processes
const completed = await client.getProcesses('my-colony', 100, ProcessState.SUCCESS);
```

---

#### assign

Assign (pull) a process for execution.

```typescript
async assign(
  colonyName: string,
  timeout: number,
  executorPrvKey: string
): Promise<Process>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `timeout` | `number` | Seconds to wait for a process (blocks until available) |
| `executorPrvKey` | `string` | Executor's private key |

**Returns:** The assigned process (now in RUNNING state)

**Example:**

```typescript
const process = await client.assign('my-colony', 60, executorPrvKey);
console.log('Assigned:', process.processid);
console.log('Function:', process.functionspec.funcname);
```

---

#### closeProcess

Close a process successfully with output.

```typescript
async closeProcess(processId: string, output: string[]): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID |
| `output` | `string[]` | Array of output strings |

**Example:**

```typescript
await client.closeProcess(process.processid, ['result1', 'result2']);
```

---

#### failProcess

Close a process with failure.

```typescript
async failProcess(processId: string, errors: string[]): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID |
| `errors` | `string[]` | Array of error messages |

---

#### removeProcess

Remove a process.

```typescript
async removeProcess(processId: string): Promise<void>
```

---

#### removeAllProcesses

Remove all processes in a colony.

```typescript
async removeAllProcesses(colonyName: string, state: number = -1): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `state` | `number` | Filter by state (-1 = all states) |

**Required Key:** Colony owner private key

---

### Workflow Operations

#### submitWorkflowSpec

Submit a workflow (DAG of processes).

```typescript
async submitWorkflowSpec(workflowSpec: {
  colonyname: string;
  functionspecs: FunctionSpec[];
}): Promise<ProcessGraph>
```

**Example:**

```typescript
const workflow = await client.submitWorkflowSpec({
  colonyname: 'my-colony',
  functionspecs: [
    {
      nodename: 'step-1',
      funcname: 'fetch-data',
      conditions: { colonyname: 'my-colony', executortype: 'worker' },
      maxwaittime: 60,
      maxexectime: 60,
    },
    {
      nodename: 'step-2',
      funcname: 'process-data',
      conditions: {
        colonyname: 'my-colony',
        executortype: 'worker',
        dependencies: ['step-1'],
      },
      maxwaittime: 60,
      maxexectime: 60,
    },
  ],
});
```

---

#### getProcessGraph

Get a workflow by ID.

```typescript
async getProcessGraph(processGraphId: string): Promise<ProcessGraph>
```

---

#### getProcessGraphs

List workflows.

```typescript
async getProcessGraphs(
  colonyName: string,
  count: number,
  state?: ProcessState
): Promise<ProcessGraph[]>
```

---

### Channel Operations

#### channelAppend

Send a message to a channel.

```typescript
async channelAppend(
  processId: string,
  channelName: string,
  sequence: number,
  inReplyTo: number,
  payload: string | Uint8Array
): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID |
| `channelName` | `string` | Name of the channel |
| `sequence` | `number` | Unique, increasing sequence number |
| `inReplyTo` | `number` | Sequence number this replies to (0 if not a reply) |
| `payload` | `string \| Uint8Array` | Message content |

**Example:**

```typescript
await client.channelAppend(processId, 'output', 1, 0, 'Hello, World!');
await client.channelAppend(processId, 'output', 2, 1, 'Reply to message 1');
```

---

#### channelRead

Read messages from a channel.

```typescript
async channelRead(
  processId: string,
  channelName: string,
  afterSeq: number,
  limit: number
): Promise<MsgEntry[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID |
| `channelName` | `string` | Name of the channel |
| `afterSeq` | `number` | Read messages after this sequence (0 = from start) |
| `limit` | `number` | Maximum messages to return |

**Returns:** Array of message entries

**Example:**

```typescript
const messages = await client.channelRead(processId, 'output', 0, 100);
for (const msg of messages) {
  console.log(`[${msg.sequence}] ${msg.payload}`);
}
```

---

#### subscribeChannel

Subscribe to a channel via WebSocket for real-time streaming.

```typescript
subscribeChannel(
  processId: string,
  channelName: string,
  afterSeq: number,
  timeout: number,
  onMessage: (entries: MsgEntry[]) => void,
  onError: (error: Error) => void,
  onClose: () => void
): WebSocket
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `processId` | `string` | Process ID |
| `channelName` | `string` | Name of the channel |
| `afterSeq` | `number` | Read messages after this sequence |
| `timeout` | `number` | Timeout in seconds |
| `onMessage` | `function` | Callback for new messages |
| `onError` | `function` | Callback for errors |
| `onClose` | `function` | Callback when connection closes |

**Returns:** WebSocket instance (call `.close()` to disconnect)

**Example:**

```typescript
const ws = client.subscribeChannel(
  processId,
  'output',
  0,
  300,
  (entries) => {
    for (const entry of entries) {
      console.log(entry.payload);
      if (entry.type === 'end') {
        ws.close();
      }
    }
  },
  (error) => console.error(error),
  () => console.log('Disconnected')
);
```

---

#### subscribeProcess

Subscribe to process state changes via WebSocket.

```typescript
subscribeProcess(
  colonyName: string,
  processId: string,
  state: number,
  timeout: number,
  onProcess: (process: Process) => void,
  onError: (error: Error) => void,
  onClose: () => void
): WebSocket
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `processId` | `string` | Process ID to watch |
| `state` | `number` | Target state to wait for |
| `timeout` | `number` | Timeout in seconds |
| `onProcess` | `function` | Callback when process reaches target state |
| `onError` | `function` | Callback for errors |
| `onClose` | `function` | Callback when connection closes |

**Returns:** WebSocket instance

**Example:**

```typescript
const ws = client.subscribeProcess(
  'my-colony',
  processId,
  ProcessState.RUNNING,
  60,
  (process) => {
    console.log('Process is running!');
    ws.close();
  },
  (error) => console.error(error),
  () => {}
);
```

---

### Blueprint Definition Operations

#### addBlueprintDefinition

Add a blueprint definition (schema for blueprints).

```typescript
async addBlueprintDefinition(definition: BlueprintDefinition): Promise<BlueprintDefinition>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `definition` | `BlueprintDefinition` | Blueprint definition object |

**Example:**

```typescript
await client.addBlueprintDefinition({
  kind: 'HomeDevice',
  metadata: {
    name: 'home-device-def',
    colonyname: 'my-colony',
  },
  spec: {
    names: {
      kind: 'HomeDevice',  // Required: must match kind used by blueprints
    },
  },
});
```

---

#### getBlueprintDefinition

Get a blueprint definition by name.

```typescript
async getBlueprintDefinition(colonyName: string, name: string): Promise<BlueprintDefinition>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `name` | `string` | Name of the blueprint definition |

---

#### getBlueprintDefinitions

List all blueprint definitions in a colony.

```typescript
async getBlueprintDefinitions(colonyName: string): Promise<BlueprintDefinition[]>
```

---

#### removeBlueprintDefinition

Remove a blueprint definition.

```typescript
async removeBlueprintDefinition(colonyName: string, name: string): Promise<void>
```

---

### Blueprint Operations

#### addBlueprint

Add a blueprint instance.

```typescript
async addBlueprint(blueprint: Blueprint): Promise<Blueprint>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `blueprint` | `Blueprint` | Blueprint object with spec (desired state) |

**Example:**

```typescript
await client.addBlueprint({
  kind: 'HomeDevice',
  metadata: {
    name: 'living-room-light',
    colonyname: 'my-colony',
  },
  handler: {
    executortype: 'home-reconciler',
  },
  spec: {
    deviceType: 'light',
    power: true,
    brightness: 80,
  },
});
```

---

#### getBlueprint

Get a blueprint by name.

```typescript
async getBlueprint(colonyName: string, name: string): Promise<Blueprint>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `name` | `string` | Name of the blueprint |

**Example:**

```typescript
const blueprint = await client.getBlueprint('my-colony', 'living-room-light');
console.log('Desired state:', blueprint.spec);
console.log('Current state:', blueprint.status);
```

---

#### getBlueprints

List blueprints in a colony with optional filters.

```typescript
async getBlueprints(
  colonyName: string,
  kind?: string,
  location?: string
): Promise<Blueprint[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `kind` | `string` | (Optional) Filter by kind |
| `location` | `string` | (Optional) Filter by location |

**Example:**

```typescript
// Get all blueprints
const all = await client.getBlueprints('my-colony');

// Get only HomeDevice blueprints
const devices = await client.getBlueprints('my-colony', 'HomeDevice');
```

---

#### updateBlueprint

Update a blueprint's spec (desired state).

```typescript
async updateBlueprint(
  blueprint: Blueprint,
  forceGeneration?: boolean
): Promise<Blueprint>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `blueprint` | `Blueprint` | Updated blueprint object |
| `forceGeneration` | `boolean` | Force generation bump (default: `false`) |

**Example:**

```typescript
const blueprint = await client.getBlueprint('my-colony', 'living-room-light');
blueprint.spec.brightness = 50;
await client.updateBlueprint(blueprint);
```

---

#### removeBlueprint

Remove a blueprint.

```typescript
async removeBlueprint(colonyName: string, name: string): Promise<void>
```

---

#### updateBlueprintStatus

Update the blueprint status (current state). Used by reconcilers to report actual state.

```typescript
async updateBlueprintStatus(
  colonyName: string,
  name: string,
  status: any
): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `name` | `string` | Name of the blueprint |
| `status` | `any` | Status object (current state) |

**Example:**

```typescript
await client.updateBlueprintStatus('my-colony', 'living-room-light', {
  power: true,
  brightness: 80,
  lastSeen: new Date().toISOString(),
});
```

---

#### reconcileBlueprint

Trigger reconciliation for a blueprint.

```typescript
async reconcileBlueprint(
  colonyName: string,
  name: string,
  force?: boolean
): Promise<Process>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `colonyName` | `string` | Name of the colony |
| `name` | `string` | Name of the blueprint |
| `force` | `boolean` | Force reconciliation (default: `false`) |

**Returns:** The reconcile process

**Example:**

```typescript
// Normal reconcile (only if changes detected)
await client.reconcileBlueprint('my-colony', 'living-room-light');

// Force reconcile (always runs)
await client.reconcileBlueprint('my-colony', 'living-room-light', true);
```

---

### Logging

#### addLog

Add a log entry for a process.

```typescript
async addLog(
  processId: string,
  message: string,
  executorPrvKey: string
): Promise<void>
```

---

#### getLogs

Get logs for a process.

```typescript
async getLogs(
  colonyName: string,
  processId: string,
  executorName: string,
  count: number = 100,
  since: number = 0
): Promise<LogEntry[]>
```

---

### Cron Jobs

#### getCrons

List cron jobs.

```typescript
async getCrons(colonyName: string, count: number = 100): Promise<Cron[]>
```

---

#### getCron

Get a cron job by ID.

```typescript
async getCron(cronId: string): Promise<Cron>
```

---

#### addCron

Create a cron job.

```typescript
async addCron(cronSpec: CronSpec): Promise<Cron>
```

---

#### removeCron

Delete a cron job.

```typescript
async removeCron(cronId: string): Promise<void>
```

---

### Generators

#### getGenerators

List generators.

```typescript
async getGenerators(colonyName: string, count: number = 100): Promise<Generator[]>
```

---

#### getGenerator

Get a generator by ID.

```typescript
async getGenerator(generatorId: string): Promise<Generator>
```

---

#### addGenerator

Create a generator.

```typescript
async addGenerator(generatorSpec: GeneratorSpec): Promise<Generator>
```

---

### Users

#### getUsers

List users in a colony.

```typescript
async getUsers(colonyName: string): Promise<User[]>
```

---

#### addUser

Add a user to a colony.

```typescript
async addUser(user: {
  name: string;
  email: string;
  phone: string;
  userid: string;
  colonyname: string;
}): Promise<User>
```

---

#### removeUser

Remove a user from a colony.

```typescript
async removeUser(colonyName: string, name: string): Promise<void>
```

---

### Files

#### getFileLabels

List file labels.

```typescript
async getFileLabels(
  colonyName: string,
  name: string = '',
  exact: boolean = false
): Promise<string[]>
```

---

#### getFiles

List files by label.

```typescript
async getFiles(colonyName: string, label: string): Promise<File[]>
```

---

### Functions

#### getFunctions

List registered functions for an executor.

```typescript
async getFunctions(executorName: string, colonyName: string): Promise<Function[]>
```

---

### Attributes

#### addAttribute

Add an attribute to a process.

```typescript
async addAttribute(attribute: {
  targetid: string;
  targetcolonyname: string;
  targetprocessgraphid: string;
  attributetype: number;
  key: string;
  value: string;
}): Promise<Attribute>
```

---

#### getAttribute

Get an attribute by ID.

```typescript
async getAttribute(attributeId: string): Promise<Attribute>
```

---

## Crypto

Cryptographic utilities using secp256k1 ECDSA.

### Constructor

```typescript
new Crypto()
```

### Methods

#### generatePrivateKey

Generate a new random private key.

```typescript
generatePrivateKey(): string
```

**Returns:** 64-character hex-encoded private key

---

#### id

Derive the public ID from a private key.

```typescript
id(privateKey: string): string
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `privateKey` | `string` | Hex-encoded private key |

**Returns:** 64-character hex-encoded public ID

---

#### sign

Sign a message.

```typescript
sign(message: string, privateKey: string): string
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `message` | `string` | Message to sign |
| `privateKey` | `string` | Hex-encoded private key |

**Returns:** Hex-encoded signature

---

## Types

### FunctionSpec

```typescript
interface FunctionSpec {
  nodename?: string;           // Name for workflow node
  funcname: string;            // Function name to execute
  args?: any[];                // Positional arguments
  kwargs?: Record<string, any>; // Keyword arguments
  priority?: number;           // Execution priority
  maxwaittime?: number;        // Max seconds to wait for assignment
  maxexectime?: number;        // Max seconds for execution
  maxretries?: number;         // Max retry attempts
  conditions?: {
    colonyname?: string;       // Colony name
    executornames?: string[];  // Specific executor names
    executortype?: string;     // Executor type filter
    dependencies?: string[];   // Workflow dependencies
    nodes?: number;            // Number of nodes
    cpu?: string;              // CPU requirements
    processes?: number;        // Number of processes
    processespernode?: number; // Processes per node
    mem?: string;              // Memory requirements
    storage?: string;          // Storage requirements
    gpu?: {
      name?: string;
      mem?: string;
      count?: number;
      nodecount?: number;
    };
    walltime?: number;         // Max wall time
  };
  label?: string;              // Label for categorization
  fs?: any;                    // Filesystem specification
  env?: Record<string, string>; // Environment variables
  channels?: string[];         // Channel names
}
```

### MsgEntry

```typescript
interface MsgEntry {
  sequence: number;     // Message sequence number
  inreplyto: number;    // Sequence of message this replies to
  type?: string;        // Message type: 'data', 'end', 'error'
  payload: string;      // Message content (UTF-8 decoded)
}
```

### Process

```typescript
interface Process {
  processid: string;
  state: number;
  functionspec: FunctionSpec;
  output?: string[];
  errors?: string[];
  input?: any[];
  // ... additional fields
}
```

---

## Enums

### ProcessState

```typescript
enum ProcessState {
  WAITING = 0,   // Submitted, waiting for executor
  RUNNING = 1,   // Assigned to executor
  SUCCESS = 2,   // Completed successfully
  FAILED = 3,    // Failed with error
}
```

---

## Error Handling

All async methods throw errors on failure. Common error patterns:

```typescript
try {
  const process = await client.submitFunctionSpec(spec);
} catch (error) {
  if (error.message.includes('colony not found')) {
    // Colony doesn't exist
  } else if (error.message.includes('not authorized')) {
    // Invalid or unauthorized private key
  } else if (error.message.includes('timeout')) {
    // Request timed out
  } else {
    // Other error
    console.error(error);
  }
}
```

---

## See Also

- [Getting Started](./getting-started.md) - Tutorial for beginners
- [Using Channels](./channels.md) - Real-time messaging guide
- [Building Reconcilers](./reconciler.md) - Blueprint and reconciler tutorial
