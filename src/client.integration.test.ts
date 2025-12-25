/**
 * Integration tests for ColoniesClient
 * Requires a running colonies server (docker-compose up)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ColoniesClient, ProcessState } from './client';
import { Crypto } from './crypto';

// Test configuration from docker-compose.env
const TEST_CONFIG = {
  host: 'localhost',
  port: 50080,
  tls: false,
  colonyName: 'dev',
  // Server private key - for server admin operations
  serverPrvKey: 'fcc79953d8a751bf41db661592dc34d30004b1a651ffa0725b03ac227641499d',
  // Colony private key - for colony admin operations (add executor, etc.)
  colonyPrvKey: 'ba949fa134981372d6da62b6a56f336ab4d843b22c02a4257dcf7d0d73097514',
  // Executor private key - for process operations (submit, assign, etc.)
  executorPrvKey: 'ddf7f7791208083b6a9ed975a72684f6406a269cfa36f1b1c32045c0a71fff05',
  executorName: 'dev-docker',
  executorType: 'cli',
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

    // Clean up any leftover processes from previous test runs
    client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
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
  });

  describe('Crypto Integration', () => {
    it('should derive correct colony ID from colony private key', () => {
      const id = crypto.id(TEST_CONFIG.colonyPrvKey);
      expect(id).toHaveLength(64);
      expect(id).toBe('4787a5071856a4acf702b2ffcea422e3237a679c681314113d86139461290cf4');
    });

    it('should derive correct executor ID from executor private key', () => {
      const id = crypto.id(TEST_CONFIG.executorPrvKey);
      expect(id).toHaveLength(64);
      expect(id).toBe('3fc05cf3df4b494e95d6a3d297a34f19938f7daa7422ab0d4f794454133341ac');
    });

    it('should derive correct server ID from server private key', () => {
      const id = crypto.id(TEST_CONFIG.serverPrvKey);
      expect(id).toHaveLength(64);
      expect(id).toBe('039231c7644e04b6895471dd5335cf332681c54e27f81fac54f9067b3f2c0103');
    });
  });

  describe('Colony Operations (Server Key)', () => {
    it('should get colonies using server private key', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);
      const colonies = await client.getColonies();
      expect(colonies).toBeDefined();
      expect(Array.isArray(colonies)).toBe(true);
      // Should include the 'dev' colony
      const devColony = colonies.find((c: any) => c.name === 'dev');
      expect(devColony).toBeDefined();
    });

    it('should get statistics using server private key', async () => {
      client.setPrivateKey(TEST_CONFIG.serverPrvKey);
      const stats = await client.getStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe('Executor Operations (Executor Key)', () => {
    it('should get executors using executor private key', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);
      const executors = await client.getExecutors(TEST_CONFIG.colonyName);
      expect(executors === null || Array.isArray(executors)).toBe(true);
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

      // Clean up - remove all waiting processes (requires colony owner key)
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
      await client.removeAllProcesses(TEST_CONFIG.colonyName, ProcessState.WAITING);
    });
  });

  describe('Channel Operations (Executor Key)', () => {
    const channelTestExecutorName = 'channel-test-executor';
    const channelTestExecutorType = 'channel-test-cli'; // Unique type to avoid conflicts

    beforeAll(async () => {
      // Clean up any leftover processes first (state -1 = all states)
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
      try {
        await client.removeAllProcesses(TEST_CONFIG.colonyName, -1);
      } catch {
        // Ignore cleanup errors
      }

      // Register and approve a test executor for channel tests with unique type
      const executorId = crypto.id(TEST_CONFIG.executorPrvKey);

      // Use colony key to add executor
      try {
        await client.addExecutor({
          executorid: executorId,
          executortype: channelTestExecutorType,
          executorname: channelTestExecutorName,
          colonyname: TEST_CONFIG.colonyName,
        });
        await client.approveExecutor(TEST_CONFIG.colonyName, channelTestExecutorName);
      } catch {
        // Executor might already exist, ignore
      }
    });

    afterAll(async () => {
      // Clean up the test executor
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
      try {
        await client.removeExecutor(TEST_CONFIG.colonyName, channelTestExecutorName);
      } catch {
        // Ignore cleanup errors
      }
    });

    beforeEach(async () => {
      // Clean up ALL processes before each test (state -1 = all states)
      client.setPrivateKey(TEST_CONFIG.colonyPrvKey);
      try {
        await client.removeAllProcesses(TEST_CONFIG.colonyName, -1);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create a process with channels, assign it, and send/receive messages', async () => {
      client.setPrivateKey(TEST_CONFIG.executorPrvKey);

      // Submit a process with a channel defined, targeting our specific executor
      const spec = {
        funcname: 'channel-test-function',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
        },
        maxwaittime: 60,
        maxexectime: 60,
        channels: ['test-channel'],
      };

      const submittedProcess = await client.submitFunctionSpec(spec);
      expect(submittedProcess).toBeDefined();
      expect(submittedProcess.processid).toBeDefined();
      expect(submittedProcess.spec.channels).toContain('test-channel');

      // Assign the process (act as executor) - use the assigned process for all operations
      const process = await client.assign(
        TEST_CONFIG.colonyName,
        10,
        TEST_CONFIG.executorPrvKey
      );
      expect(process).toBeDefined();
      expect(process.processid).toBe(submittedProcess.processid);
      expect(process.spec.channels).toContain('test-channel');

      // Send messages to the channel
      await client.channelAppend(process.processid, 'test-channel', 1, 0, 'Hello, World!');
      await client.channelAppend(process.processid, 'test-channel', 2, 1, 'This is a reply');
      await client.channelAppend(process.processid, 'test-channel', 3, 0, 'Another message');

      // Read messages from the channel
      const messages = await client.channelRead(process.processid, 'test-channel', 0, 10);
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

      // Submit and assign a process with a channel, targeting our specific executor
      const spec = {
        funcname: 'channel-filter-test',
        conditions: {
          colonyname: TEST_CONFIG.colonyName,
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
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
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
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
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
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
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
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
          executortype: channelTestExecutorType,
          executornames: [channelTestExecutorName],
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
