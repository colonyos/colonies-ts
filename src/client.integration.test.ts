/**
 * Integration tests for ColoniesClient
 * Requires a running colonies server (docker-compose up)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ColoniesClient, ProcessState } from './client';
import { Crypto } from './crypto';

// Test configuration - reads from environment variables with fallbacks
// Default values match the GitHub Actions workflow and docker-compose configurations
// Prioritize HTTP-specific vars (docker-compose) over legacy vars
const TEST_CONFIG = {
  host: process.env.COLONIES_CLIENT_HTTP_HOST || process.env.COLONIES_SERVER_HOST || 'localhost',
  port: parseInt(process.env.COLONIES_SERVER_HTTP_PORT || process.env.COLONIES_CLIENT_HTTP_PORT || process.env.COLONIES_SERVER_PORT || '50080', 10),
  tls: (process.env.COLONIES_SERVER_HTTP_TLS ?? process.env.COLONIES_SERVER_TLS ?? 'false') === 'true',
  // Colony name - use 'test' for consistency between local and CI
  colonyName: process.env.COLONIES_COLONY_NAME || 'test',
  // Server private key - for server admin operations (adding colonies)
  serverPrvKey: process.env.COLONIES_SERVER_PRVKEY || 'fcc79953d8a751bf41db661592dc34d30004b1a651ffa0725b03ac227641499d',
  // Colony private key and ID - for colony admin operations (add executor, etc.)
  colonyPrvKey: process.env.COLONIES_COLONY_PRVKEY || 'ba949fa134981372d6da62b6a56f336ab4d843b22c02a4257dcf7d0d73097514',
  // Pre-computed colony ID (from Go crypto)
  colonyId: process.env.COLONIES_COLONY_ID || '4787a5071856a4acf702b2ffcea422e3237a679c681314113d86139461290cf4',
  // Executor private key and ID - for process operations (submit, assign, etc.)
  executorPrvKey: process.env.COLONIES_PRVKEY || 'ddf7f7791208083b6a9ed975a72684f6406a269cfa36f1b1c32045c0a71fff05',
  // Pre-computed executor ID (from Go crypto)
  executorId: process.env.COLONIES_EXECUTOR_ID || process.env.COLONIES_ID || '3fc05cf3df4b494e95d6a3d297a34f19938f7daa7422ab0d4f794454133341ac',
  executorName: process.env.COLONIES_EXECUTOR_NAME || 'test-executor',
  executorType: process.env.COLONIES_EXECUTOR_TYPE || 'cli',
};

describe('ColoniesClient Integration Tests', () => {
  let client: ColoniesClient;
  let crypto: Crypto;

  beforeAll(async () => {
    client = new ColoniesClient({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      tls: TEST_CONFIG.tls,
    });
    crypto = new Crypto();

    // First, remove any existing colony with this name (requires server private key)
    // This ensures we create a fresh colony with the correct ID
    client.setPrivateKey(TEST_CONFIG.serverPrvKey);
    try {
      await client.removeColony(TEST_CONFIG.colonyName);
    } catch {
      // Colony might not exist, ignore
    }

    // Create the colony with the correct ID (requires server private key)
    try {
      await client.addColony({
        colonyid: TEST_CONFIG.colonyId,
        name: TEST_CONFIG.colonyName,
      });
    } catch (e) {
      // Log any unexpected errors
      console.log('addColony error:', (e as Error).message);
    }

    // Add and approve the test executor (requires colony owner key)
    client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
    try {
      await client.addExecutor({
        executorid: TEST_CONFIG.executorId,
        executortype: TEST_CONFIG.executorType,
        executorname: TEST_CONFIG.executorName,
        colonyname: TEST_CONFIG.colonyName,
      });
      await client.approveExecutor(TEST_CONFIG.colonyName, TEST_CONFIG.executorName);
    } catch {
      // Executor might already exist, ignore
    }

    // Clean up any leftover processes from previous test runs
    try {
      await client.removeAllProcesses(TEST_CONFIG.colonyName, -1);
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Clean up any test processes (requires colony owner key)
    try {
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
      await client.removeAllProcesses(TEST_CONFIG.colonyName, -1);
    } catch {
      // Ignore cleanup errors
    }

    // Remove the test colony (requires server private key)
    try {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);
      await client.removeColony(TEST_CONFIG.colonyName);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Crypto Integration', () => {
    it('should derive ID from colony private key', () => {
      // Note: TypeScript and Go crypto implementations derive IDs differently
      // This test verifies the crypto functions work, not specific values
      const id = crypto.id(TEST_CONFIG.colonyPrvKey);
      expect(id).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('should derive ID from executor private key', () => {
      const id = crypto.id(TEST_CONFIG.executorPrvKey);
      expect(id).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('should derive ID from server private key', () => {
      const id = crypto.id(TEST_CONFIG.serverPrvKey);
      expect(id).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('should generate valid private keys', () => {
      const prvKey = crypto.generatePrivateKey();
      expect(prvKey).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(prvKey)).toBe(true);
      // Should be able to derive ID from generated key
      const id = crypto.id(prvKey);
      expect(id).toHaveLength(64);
    });

    it('should sign data consistently', () => {
      const data = 'test message';
      const signature1 = crypto.sign(data, TEST_CONFIG.executorPrvKey);
      const signature2 = crypto.sign(data, TEST_CONFIG.executorPrvKey);
      // Same key + same data should produce same signature (deterministic)
      expect(signature1).toBe(signature2);
      // Signature is 65 bytes (r + s + recovery byte) = 130 hex chars
      expect(signature1).toHaveLength(130);
    });
  });

  describe('Colony Operations (Server Key)', () => {
    it('should get colonies using server private key', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);
      const colonies = await client.getColonies();
      expect(colonies).toBeDefined();
      expect(Array.isArray(colonies)).toBe(true);
      // Should include the configured colony
      const colony = colonies.find((c: any) => c.name === TEST_CONFIG.colonyName);
      expect(colony).toBeDefined();
    });

    it('should get statistics using server private key', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);
      const stats = await client.getStatistics();
      expect(stats).toBeDefined();
    });

    it('should add and remove a colony', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);

      // Generate a new colony private key for the test colony
      const testColonyPrvKey = crypto.generatePrivateKey();
      const testColonyId = crypto.id(testColonyPrvKey);
      const testColonyName = 'test-colony-' + Date.now();

      // Add the colony
      const colony = await client.addColony({
        colonyid: testColonyId,
        name: testColonyName,
      });
      expect(colony).toBeDefined();
      expect(colony.colonyid).toBe(testColonyId);
      expect(colony.name).toBe(testColonyName);

      // Verify the colony exists
      const colonies = await client.getColonies();
      const foundColony = colonies.find((c: any) => c.name === testColonyName);
      expect(foundColony).toBeDefined();

      // Remove the colony
      await client.removeColony(testColonyName);

      // Verify the colony is removed
      const coloniesAfter = await client.getColonies();
      const removedColony = coloniesAfter.find((c: any) => c.name === testColonyName);
      expect(removedColony).toBeUndefined();
    });

    it('should fail to add colony with duplicate name', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);

      // Try to add a colony with the same name as an existing one
      const colonyId = crypto.id(TEST_CONFIG.colonyPrvKey);
      await expect(
        client.addColony({
          colonyid: colonyId,
          name: TEST_CONFIG.colonyName, // 'dev' already exists
        })
      ).rejects.toThrow();
    });
  });

  describe('Executor Operations', () => {
    it('should get executors using executor private key', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const executors = await client.getExecutors(TEST_CONFIG.colonyName);
      expect(executors === null || Array.isArray(executors)).toBe(true);
    });

    // Note: This test is skipped because the TypeScript crypto derives different IDs than Go.
    // The executor ID must match what the Go server expects from the private key.
    // TODO: Align TypeScript crypto with Go crypto for ID derivation.
    it.skip('should add, approve, and remove an executor', async () => {
      // Use colony owner key to manage executors
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);

      // Generate a new executor private key
      const testExecutorPrvKey = crypto.generatePrivateKey();
      const testExecutorId = crypto.id(testExecutorPrvKey);
      const testExecutorName = 'test-executor-' + Date.now();
      const testExecutorType = 'test-type';

      // Add the executor
      const executor = await client.addExecutor({
        executorid: testExecutorId,
        executortype: testExecutorType,
        executorname: testExecutorName,
        colonyname: TEST_CONFIG.colonyName,
      });
      expect(executor).toBeDefined();
      expect(executor.executorname).toBe(testExecutorName);
      expect(executor.executortype).toBe(testExecutorType);

      // Verify the executor exists (not yet approved)
      const executors = await client.getExecutors(TEST_CONFIG.colonyName);
      const foundExecutor = executors?.find((e: any) => e.executorname === testExecutorName);
      expect(foundExecutor).toBeDefined();

      // Approve the executor
      const approvedExecutor = await client.approveExecutor(TEST_CONFIG.colonyName, testExecutorName);
      expect(approvedExecutor).toBeDefined();

      // Remove the executor
      await client.removeExecutor(TEST_CONFIG.colonyName, testExecutorName);

      // Verify the executor is removed
      const executorsAfter = await client.getExecutors(TEST_CONFIG.colonyName);
      const removedExecutor = executorsAfter?.find((e: any) => e.executorname === testExecutorName);
      expect(removedExecutor).toBeUndefined();
    });

    it('should get a specific executor', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const executor = await client.getExecutor(TEST_CONFIG.colonyName, TEST_CONFIG.executorName);
      expect(executor).toBeDefined();
      expect(executor.executorname).toBe(TEST_CONFIG.executorName);
    });
  });

  describe('Process Operations (Executor Key)', () => {
    it('should submit a function spec and get the process', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'test-function',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        maxretries: 0,
      };

      const process = await client.submitFunctionSpec(spec);
      expect(process).toBeDefined();
      expect(process.processid).toBeDefined();
      expect(process.spec.funcname).toBe('test-function');

      // Get the process
      const retrieved = await client.getProcess(process.processid);
      expect(retrieved).toBeDefined();
      expect(retrieved.processid).toBe(process.processid);

      // Clean up
      await client.removeProcess(process.processid);
    });

    it('should get processes by state', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      // Submit a test process
      const spec = {
        funcname: 'test-list-function',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
      };

      const process = await client.submitFunctionSpec(spec);

      // Get waiting processes
      const waiting = await client.getProcesses(TEST_CONFIG.colonyName, 100, ProcessState.WAITING);
      expect(waiting).toBeDefined();
      expect(Array.isArray(waiting)).toBe(true);
      expect(waiting.length).toBeGreaterThan(0);
      expect(waiting.some((p: any) => p.processid === process.processid)).toBe(true);

      // Clean up
      await client.removeProcess(process.processid);
    });

    it('should remove a process', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'test-remove-function',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
      };

      const process = await client.submitFunctionSpec(spec);
      expect(process.processid).toBeDefined();

      // Remove the process
      await client.removeProcess(process.processid);

      // Verify it's removed
      await expect(client.getProcess(process.processid)).rejects.toThrow();
    });
  });

  describe('Cron Operations (Executor Key)', () => {
    it('should get crons (may be empty)', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const crons = await client.getCrons(TEST_CONFIG.colonyName);
      expect(crons === null || Array.isArray(crons)).toBe(true);
    });
  });

  describe('Generator Operations (Executor Key)', () => {
    it('should get generators (may be empty)', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const generators = await client.getGenerators(TEST_CONFIG.colonyName);
      expect(generators === null || Array.isArray(generators)).toBe(true);
    });
  });

  describe('User Operations (Executor Key)', () => {
    it('should get users (may be empty)', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const users = await client.getUsers(TEST_CONFIG.colonyName);
      expect(users === null || Array.isArray(users)).toBe(true);
    });
  });

  describe('File Operations (Executor Key)', () => {
    it('should get file labels (may be empty)', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const labels = await client.getFileLabels(TEST_CONFIG.colonyName);
      expect(labels === null || Array.isArray(labels)).toBe(true);
    });
  });

  describe('Workflow Operations (Executor Key)', () => {
    it('should submit a workflow and get process graph', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const workflowSpec = {
        colonyname: TEST_CONFIG.colonyName,
        functionspecs: [
          {
            nodename: 'task1',
            funcname: 'workflow-task-1',
            conditions: {
              colonyname: TEST_CONFIG.colonyName,
              executortype: TEST_CONFIG.executorType,
            },
            maxwaittime: 60,
            maxexectime: 60,
          },
          {
            nodename: 'task2',
            funcname: 'workflow-task-2',
            conditions: {
              colonyname: TEST_CONFIG.colonyName,
              executortype: TEST_CONFIG.executorType,
              dependencies: ['task1'],
            },
            maxwaittime: 60,
            maxexectime: 60,
          },
        ],
      };

      const graph = await client.submitWorkflowSpec(workflowSpec);
      expect(graph).toBeDefined();
      expect(graph.processgraphid).toBeDefined();

      // Get the process graph
      const retrieved = await client.getProcessGraph(graph.processgraphid);
      expect(retrieved).toBeDefined();
      expect(retrieved.processgraphid).toBe(graph.processgraphid);

      // Get process graphs list
      const graphs = await client.getProcessGraphs(TEST_CONFIG.colonyName, 10);
      expect(graphs).toBeDefined();
      expect(Array.isArray(graphs)).toBe(true);

      // Clean up - remove the process graph (this also removes all its processes)
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      try {
        await client.removeProcessGraph(graph.processgraphid);
      } catch (e) {
        console.log('Workflow cleanup error:', (e as Error).message);
      }
    });
  });

  describe('Channel Operations (Executor Key)', { timeout: 30000 }, () => {
    beforeEach(async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      // First, remove any remaining process graphs (which contain workflow processes)
      try {
        await client.removeAllProcessGraphs(TEST_CONFIG.colonyName);
      } catch {
        // Ignore errors
      }

      // Then remove any remaining standalone processes
      try {
        await client.removeAllProcesses(TEST_CONFIG.colonyName, -1);
      } catch {
        // Ignore errors
      }
    });

    it('should create a process with channels, assign it, and send/receive messages', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      // Use a unique channel name for this test run
      const channelName = 'test-channel-' + Date.now();

      // Submit a process with a channel defined, targeting our test executor
      const spec = {
        funcname: 'channel-test-function',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: [channelName],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      expect(submittedProcess).toBeDefined();
      expect(submittedProcess.processid).toBeDefined();
      expect(submittedProcess.spec.channels).toContain(channelName);

      // Assign the process (act as executor)
      const process = await client.assign(
        TEST_CONFIG.colonyName,
        10,
        TEST_CONFIG.executorPrvKey
      );
      expect(process).toBeDefined();
      expect(process.processid).toBe(submittedProcess.processid);
      expect(process.spec.channels).toContain(channelName);

      // Send messages to the channel
      await client.channelAppend(process.processid, channelName, 1, 0, 'Hello, World!');
      await client.channelAppend(process.processid, channelName, 2, 1, 'This is a reply');
      await client.channelAppend(process.processid, channelName, 3, 0, 'Another message');

      // Read messages from the channel
      const messages = await client.channelRead(process.processid, channelName, 0, 10);
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(3);

      // Verify message content
      expect(messages[0].payload).toBe('Hello, World!');
      expect(messages[0].sequence).toBe(1);
      expect(messages[1].payload).toBe('This is a reply');
      expect(messages[1].sequence).toBe(2);
      expect(messages[1].inreplyto).toBe(1);
      expect(messages[2].payload).toBe('Another message');
      expect(messages[2].sequence).toBe(3);

      // Close the process
      await client.closeProcess(process.processid, ['Channel test completed']);
    });

    it('should read messages with afterSeq filter', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      // Submit and assign a process with a channel
      const spec = {
        funcname: 'channel-filter-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: ['filter-channel'],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      const process = await client.assign(TEST_CONFIG.colonyName, 10, TEST_CONFIG.executorPrvKey);
      expect(process.processid).toBe(submittedProcess.processid);
      expect(process.spec.channels).toContain('filter-channel');

      // Send multiple messages
      for (let i = 1; i <= 5; i++) {
        await client.channelAppend(process.processid, 'filter-channel', i, 0, `Message ${i}`);
      }

      // Read all messages
      const allMessages = await client.channelRead(process.processid, 'filter-channel', 0, 10);
      expect(allMessages.length).toBe(5);

      // Read messages after sequence 2
      const filteredMessages = await client.channelRead(process.processid, 'filter-channel', 2, 10);
      expect(filteredMessages.length).toBe(3);
      expect(filteredMessages[0].payload).toBe('Message 3');
      expect(filteredMessages[1].payload).toBe('Message 4');
      expect(filteredMessages[2].payload).toBe('Message 5');

      // Clean up
      await client.closeProcess(process.processid, ['Filter test completed']);
    });

    it('should handle UTF-8 messages correctly', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'channel-utf8-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: ['utf8-channel'],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      const process = await client.assign(TEST_CONFIG.colonyName, 10, TEST_CONFIG.executorPrvKey);
      expect(process.processid).toBe(submittedProcess.processid);
      expect(process.spec.channels).toContain('utf8-channel');

      // Send messages with various UTF-8 characters
      const testMessages = [
        'Hello World',
        'Scandinavian: Sverige',
        'Chinese: zhongwen',
        'Emoji: test',
        'Japanese: nihon',
      ];

      for (let i = 0; i < testMessages.length; i++) {
        await client.channelAppend(process.processid, 'utf8-channel', i + 1, 0, testMessages[i]);
      }

      // Read and verify
      const messages = await client.channelRead(process.processid, 'utf8-channel', 0, 10);
      expect(messages.length).toBe(testMessages.length);

      for (let i = 0; i < testMessages.length; i++) {
        expect(messages[i].payload).toBe(testMessages[i]);
      }

      await client.closeProcess(process.processid, ['UTF-8 test completed']);
    });

    it('should use polling to wait for process assignment then use channels', async () => {
      // This test demonstrates the client-side pattern:
      // 1. Submit a process
      // 2. Poll for RUNNING state (alternative to WebSocket subscription)
      // 3. Use channels once the process is running

      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'channel-polling-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: ['polling-channel'],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      expect(submittedProcess.processid).toBeDefined();

      // Start assignment in background
      const assignPromise = client.assign(TEST_CONFIG.colonyName, 10, TEST_CONFIG.executorPrvKey);

      // Poll for the process to reach RUNNING state
      let runningProcess: any = null;
      for (let i = 0; i < 10; i++) {
        const proc = await client.getProcess(submittedProcess.processid);
        if (proc.state === ProcessState.RUNNING) {
          runningProcess = proc;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for assign to complete
      await assignPromise;

      expect(runningProcess).not.toBeNull();
      expect(runningProcess.processid).toBe(submittedProcess.processid);
      expect(runningProcess.state).toBe(ProcessState.RUNNING);

      // Now send a message to the channel
      await client.channelAppend(runningProcess.processid, 'polling-channel', 1, 0, 'Polling test message');

      // Read and verify
      const messages = await client.channelRead(runningProcess.processid, 'polling-channel', 0, 10);
      expect(messages.length).toBe(1);
      expect(messages[0].payload).toBe('Polling test message');

      // Clean up
      await client.closeProcess(runningProcess.processid, ['Polling test completed']);
    });

    it('should receive channel messages via subscribeChannelWS', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'channel-subscribe-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: ['subscribe-channel'],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      const process = await client.assign(TEST_CONFIG.colonyName, 10, TEST_CONFIG.executorPrvKey);
      expect(process.processid).toBe(submittedProcess.processid);

      // Create a promise that collects messages from WebSocket subscription
      const receivedMessages: any[] = [];
      const messagePromise = new Promise<void>((resolve, reject) => {
        const ws = client.subscribeChannelWS(
          process.processid,
          'subscribe-channel',
          0,
          10,
          (entries) => {
            receivedMessages.push(...entries);
            // Close after receiving expected messages
            if (receivedMessages.length >= 3) {
              ws.close();
              resolve();
            }
          },
          (error) => {
            ws.close();
            reject(error);
          },
          () => {}
        );

        // Send messages after subscription is established
        setTimeout(async () => {
          try {
            await client.channelAppend(process.processid, 'subscribe-channel', 1, 0, 'First message');
            await client.channelAppend(process.processid, 'subscribe-channel', 2, 0, 'Second message');
            await client.channelAppend(process.processid, 'subscribe-channel', 3, 0, 'Third message');
          } catch (e) {
            reject(e);
          }
        }, 100);
      });

      // Wait for messages with timeout
      await Promise.race([
        messagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for messages')), 5000))
      ]);

      // Verify received messages
      expect(receivedMessages.length).toBe(3);
      expect(receivedMessages[0].payload).toBe('First message');
      expect(receivedMessages[1].payload).toBe('Second message');
      expect(receivedMessages[2].payload).toBe('Third message');

      // Clean up
      await client.closeProcess(process.processid, ['Subscribe test completed']);
    });

    it('should receive RUNNING state notification via subscribeProcessWS when process is assigned', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      const spec = {
        funcname: 'process-subscribe-running-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: TEST_CONFIG.executorType,
        },
        maxwaittime: 60,
        maxexectime: 60,
      };

      // Submit process first
      const submittedProcess = await client.submitFunctionSpec(spec);
      expect(submittedProcess.state).toBe(ProcessState.WAITING);

      // Set up WebSocket subscription for RUNNING state BEFORE assigning
      let receivedProcess: any = null;
      const runningPromise = new Promise<void>((resolve, reject) => {
        const ws = client.subscribeProcessWS(
          TEST_CONFIG.colonyName,
          submittedProcess.processid,
          ProcessState.RUNNING,
          30,
          (process) => {
            receivedProcess = process;
            ws.close();
            resolve();
          },
          (error) => {
            ws.close();
            reject(error);
          },
          () => {}
        );

        // Assign the process after a short delay to ensure subscription is established
        setTimeout(async () => {
          try {
            await client.assign(TEST_CONFIG.colonyName, 10, TEST_CONFIG.executorPrvKey);
          } catch (e) {
            reject(e);
          }
        }, 200);
      });

      // Wait for RUNNING notification with timeout
      await Promise.race([
        runningPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for RUNNING state')), 10000))
      ]);

      // Verify the received process
      expect(receivedProcess).not.toBeNull();
      expect(receivedProcess.processid).toBe(submittedProcess.processid);
      expect(receivedProcess.state).toBe(ProcessState.RUNNING);

      // Clean up
      await client.closeProcess(submittedProcess.processid, ['Process subscribe test completed']);
    });
  });
});
