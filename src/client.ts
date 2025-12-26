/**
 * ColonyOS Client
 * Ported from colonyspace/aila/src/lib/api/colony.ts
 */

import { Crypto } from './crypto';

// Helper function to decode base64 payload with proper UTF-8 handling
function decodeBase64Utf8(base64: string): string {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// Helper function to encode string to base64 with proper UTF-8 handling
function encodeBase64Utf8(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryStr = String.fromCharCode(...utf8Bytes);
  return btoa(binaryStr);
}

export interface ColoniesClientConfig {
  host: string;
  port: number;
  tls?: boolean;
}

export interface RPCMessage {
  payloadtype: string;
  payload: string;
  signature: string;
}

export interface FunctionSpec {
  nodename?: string;
  funcname: string;
  args?: any[];
  kwargs?: Record<string, any>;
  priority?: number;
  maxwaittime?: number;
  maxexectime?: number;
  maxretries?: number;
  conditions?: {
    colonyname?: string;
    executornames?: string[];
    executortype?: string;
    dependencies?: string[];
    nodes?: number;
    cpu?: string;
    processes?: number;
    processespernode?: number;
    mem?: string;
    storage?: string;
    gpu?: { name?: string; mem?: string; count?: number; nodecount?: number };
    walltime?: number;
  };
  label?: string;
  fs?: any;
  env?: Record<string, string>;
  channels?: string[];
}

export enum ProcessState {
  WAITING = 0,
  RUNNING = 1,
  SUCCESS = 2,
  FAILED = 3,
}

export class ColoniesClient {
  private host: string;
  private port: number;
  private tls: boolean;
  private crypto: Crypto;
  private privateKey: string | null = null;

  constructor(config: ColoniesClientConfig) {
    this.host = config.host;
    this.port = config.port;
    this.tls = config.tls ?? false;
    this.crypto = new Crypto();
  }

  setPrivateKey(privateKey: string): void {
    this.privateKey = privateKey;
  }

  private getBaseUrl(): string {
    const protocol = this.tls ? 'https' : 'http';
    return `${protocol}://${this.host}:${this.port}/api`;
  }

  private createRPCMsg(msg: any): RPCMessage {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey() first.');
    }

    const payload = encodeBase64Utf8(JSON.stringify(msg));
    const signature = this.crypto.sign(payload, this.privateKey);

    return {
      payloadtype: msg.msgtype,
      payload,
      signature,
    };
  }

  private async sendRPC(rpcMessage: RPCMessage): Promise<any> {
    const url = this.getBaseUrl();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }

      if (errorObj.payload) {
        try {
          const decodedPayload = decodeBase64Utf8(errorObj.payload);
          const decodedError = JSON.parse(decodedPayload);
          throw new Error(decodedError.message || JSON.stringify(decodedError));
        } catch (e) {
          if (e instanceof Error && e.message !== 'Request failed') {
            throw e;
          }
        }
      }
      throw new Error(JSON.stringify(errorObj));
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Server returned empty response');
    }

    const rpcReplyMsg = JSON.parse(responseText);
    const msg = JSON.parse(decodeBase64Utf8(rpcReplyMsg.payload));

    if (rpcReplyMsg.error === true) {
      const errorMessage = typeof msg === 'object' && msg.message ? msg.message : JSON.stringify(msg);
      throw new Error(errorMessage);
    }

    return msg;
  }

  // ==================== Colony Methods ====================

  async getColonies(): Promise<any> {
    const msg = { msgtype: 'getcoloniesmsg' };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getStatistics(): Promise<any> {
    const msg = { msgtype: 'getstatisticsmsg' };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Add a new colony (requires server private key)
   * @param colony - Colony object with colonyid and name
   */
  async addColony(colony: { colonyid: string; name: string }): Promise<any> {
    const msg = {
      msgtype: 'addcolonymsg',
      colony,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Remove a colony (requires server private key)
   * @param colonyName - Name of the colony to remove
   */
  async removeColony(colonyName: string): Promise<any> {
    const msg = {
      msgtype: 'removecolonymsg',
      colonyname: colonyName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Executor Methods ====================

  async getExecutors(colonyName: string): Promise<any> {
    const msg = {
      msgtype: 'getexecutorsmsg',
      colonyname: colonyName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getExecutor(colonyName: string, executorName: string): Promise<any> {
    const msg = {
      msgtype: 'getexecutormsg',
      colonyname: colonyName,
      executorname: executorName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async addExecutor(executor: {
    executorid: string;
    executortype: string;
    executorname: string;
    colonyname: string;
  }): Promise<any> {
    const msg = {
      msgtype: 'addexecutormsg',
      executor,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async approveExecutor(colonyName: string, executorName: string): Promise<any> {
    const msg = {
      msgtype: 'approveexecutormsg',
      colonyname: colonyName,
      executorname: executorName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeExecutor(colonyName: string, executorName: string): Promise<any> {
    const msg = {
      msgtype: 'removeexecutormsg',
      colonyname: colonyName,
      executorname: executorName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Process Methods ====================

  async submitFunctionSpec(spec: FunctionSpec): Promise<any> {
    const msg = {
      msgtype: 'submitfuncspecmsg',
      spec,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getProcess(processId: string): Promise<any> {
    const msg = {
      msgtype: 'getprocessmsg',
      processid: processId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getProcesses(colonyName: string, count: number, state: ProcessState): Promise<any> {
    const msg = {
      msgtype: 'getprocessesmsg',
      colonyname: colonyName,
      count,
      state,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeProcess(processId: string): Promise<any> {
    const msg = {
      msgtype: 'removeprocessmsg',
      processid: processId,
      all: false,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeAllProcesses(colonyName: string, state: number = -1): Promise<any> {
    const msg = {
      msgtype: 'removeallprocessesmsg',
      colonyname: colonyName,
      state,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async assign(colonyName: string, timeout: number, executorPrvKey: string): Promise<any> {
    // Temporarily set the executor private key for this operation
    const originalKey = this.privateKey;
    this.setPrivateKey(executorPrvKey);

    try {
      const msg = {
        msgtype: 'assignprocessmsg',
        colonyname: colonyName,
        timeout,
      };
      return this.sendRPC(this.createRPCMsg(msg));
    } finally {
      if (originalKey) {
        this.setPrivateKey(originalKey);
      }
    }
  }

  async closeProcess(processId: string, output: string[]): Promise<any> {
    const msg = {
      msgtype: 'closesuccessfulmsg',
      processid: processId,
      out: output,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async failProcess(processId: string, errors: string[]): Promise<any> {
    const msg = {
      msgtype: 'closefailedmsg',
      processid: processId,
      errors,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Workflow Methods ====================

  async submitWorkflowSpec(workflowSpec: {
    colonyname: string;
    functionspecs: FunctionSpec[];
  }): Promise<any> {
    const msg = {
      msgtype: 'submitworkflowspecmsg',
      spec: workflowSpec,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getProcessGraph(processGraphId: string): Promise<any> {
    const msg = {
      msgtype: 'getprocessgraphmsg',
      processgraphid: processGraphId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getProcessGraphs(colonyName: string, count: number, state?: ProcessState): Promise<any> {
    const msg: any = {
      msgtype: 'getprocessgraphsmsg',
      colonyname: colonyName,
      count,
    };
    if (state !== undefined) {
      msg.state = state;
    }
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeProcessGraph(processGraphId: string): Promise<any> {
    const msg = {
      msgtype: 'removeprocessgraphmsg',
      processgraphid: processGraphId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getProcessesForWorkflow(processGraphId: string, colonyName: string, count: number = 100): Promise<any> {
    const msg = {
      msgtype: 'getprocessesmsg',
      processgraphid: processGraphId,
      colonyname: colonyName,
      count,
      state: -1,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeAllProcessGraphs(colonyName: string, state?: ProcessState): Promise<any> {
    const msg: any = {
      msgtype: 'removeallprocessgraphsmsg',
      colonyname: colonyName,
    };
    if (state !== undefined) {
      msg.state = state;
    }
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Log Methods ====================

  async addLog(processId: string, message: string, executorPrvKey: string): Promise<any> {
    const originalKey = this.privateKey;
    this.setPrivateKey(executorPrvKey);

    try {
      const msg = {
        msgtype: 'addlogmsg',
        processid: processId,
        message,
      };
      return this.sendRPC(this.createRPCMsg(msg));
    } finally {
      if (originalKey) {
        this.setPrivateKey(originalKey);
      }
    }
  }

  async getLogs(colonyName: string, processId: string, executorName: string, count: number = 100, since: number = 0): Promise<any> {
    const msg = {
      msgtype: 'getlogsmsg',
      colonyname: colonyName,
      processid: processId,
      executorname: executorName,
      count,
      since,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Function Methods ====================

  async getFunctions(executorName: string, colonyName: string): Promise<any> {
    const msg = {
      msgtype: 'getfunctionsmsg',
      executorname: executorName,
      colonyname: colonyName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Cron Methods ====================

  async getCrons(colonyName: string, count: number = 100): Promise<any> {
    const msg = {
      msgtype: 'getcronsmsg',
      colonyname: colonyName,
      count,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getCron(cronId: string): Promise<any> {
    const msg = {
      msgtype: 'getcronmsg',
      cronid: cronId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async addCron(cronSpec: any): Promise<any> {
    const msg = {
      msgtype: 'addcronmsg',
      cron: cronSpec,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeCron(cronId: string): Promise<any> {
    const msg = {
      msgtype: 'removecronmsg',
      cronid: cronId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async runCron(cronId: string): Promise<any> {
    const msg = {
      msgtype: 'runcronmsg',
      cronid: cronId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Generator Methods ====================

  async getGenerators(colonyName: string, count: number = 100): Promise<any> {
    const msg = {
      msgtype: 'getgeneratorsmsg',
      colonyname: colonyName,
      count,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getGenerator(generatorId: string): Promise<any> {
    const msg = {
      msgtype: 'getgeneratormsg',
      generatorid: generatorId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async addGenerator(generatorSpec: any): Promise<any> {
    const msg = {
      msgtype: 'addgeneratormsg',
      generator: generatorSpec,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== User Methods ====================

  async getUsers(colonyName: string): Promise<any> {
    const msg = {
      msgtype: 'getusersmsg',
      colonyname: colonyName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async addUser(user: {
    colonyname: string;
    userid: string;
    name: string;
    email: string;
    phone: string;
  }): Promise<any> {
    const msg = {
      msgtype: 'addusermsg',
      user,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async removeUser(colonyName: string, name: string): Promise<any> {
    const msg = {
      msgtype: 'removeusermsg',
      colonyname: colonyName,
      name,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== File Methods ====================

  async getFileLabels(colonyName: string, name: string = '', exact: boolean = false): Promise<any> {
    const msg = {
      msgtype: 'getfilelabelsmsg',
      colonyname: colonyName,
      name,
      exact,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getFiles(colonyName: string, label: string): Promise<any> {
    const msg = {
      msgtype: 'getfilesmsg',
      colonyname: colonyName,
      label,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getFile(
    colonyName: string,
    options: { fileId: string } | { name: string; label: string; latest?: boolean }
  ): Promise<any> {
    const msg: any = {
      msgtype: 'getfilemsg',
      colonyname: colonyName,
    };

    if ('fileId' in options) {
      msg.fileid = options.fileId;
    } else {
      msg.name = options.name;
      msg.label = options.label;
      if (options.latest !== undefined) {
        msg.latest = options.latest;
      }
    }

    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Attribute Methods ====================

  async addAttribute(attribute: {
    targetid: string;
    targetcolonyname: string;
    targetprocessgraphid: string;
    attributetype: number;
    key: string;
    value: string;
  }): Promise<any> {
    const msg = {
      msgtype: 'addattributemsg',
      attribute,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  async getAttribute(attributeId: string): Promise<any> {
    const msg = {
      msgtype: 'getattributemsg',
      attributeid: attributeId,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Channel Methods ====================

  /**
   * Append a message to a process channel
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param sequence - Client-assigned sequence number
   * @param inReplyTo - Sequence number this message is replying to (0 if not a reply)
   * @param payload - Message content (string or Uint8Array)
   */
  async channelAppend(
    processId: string,
    channelName: string,
    sequence: number,
    inReplyTo: number,
    payload: string | Uint8Array
  ): Promise<any> {
    let payloadBytes: number[];
    if (typeof payload === 'string') {
      const encoder = new TextEncoder();
      payloadBytes = Array.from(encoder.encode(payload));
    } else {
      payloadBytes = Array.from(payload);
    }

    const msg = {
      msgtype: 'channelappendmsg',
      processid: processId,
      name: channelName,
      sequence: sequence,
      inreplyto: inReplyTo,
      payload: payloadBytes,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Read messages from a process channel
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param afterSeq - Read messages after this sequence number (use 0 for all)
   * @param limit - Maximum number of messages to return (0 for no limit)
   */
  async channelRead(
    processId: string,
    channelName: string,
    afterSeq: number,
    limit: number
  ): Promise<any[]> {
    const msg = {
      msgtype: 'channelreadmsg',
      processid: processId,
      name: channelName,
      afterseq: afterSeq,
      limit: limit,
    };

    const response = await this.sendRPC(this.createRPCMsg(msg));

    // Response is an array of channel entries, decode payload bytes if needed
    if (Array.isArray(response)) {
      return response.map((entry) => ({
        ...entry,
        payload:
          typeof entry.payload === 'string'
            ? (() => {
                try {
                  const binaryStr = atob(entry.payload);
                  const bytes = new Uint8Array(binaryStr.length);
                  for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                  }
                  return new TextDecoder('utf-8').decode(bytes);
                } catch {
                  return entry.payload;
                }
              })()
            : Array.isArray(entry.payload)
              ? new TextDecoder('utf-8').decode(new Uint8Array(entry.payload))
              : entry.payload,
      }));
    }

    return response || [];
  }

  /**
   * Subscribe to a channel using WebSocket for real-time updates
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param afterSeq - Start reading after this sequence number
   * @param timeout - Timeout in seconds for the subscription
   * @param onMessage - Callback for new messages
   * @param onError - Callback for errors
   * @param onClose - Callback when connection closes
   * @returns WebSocket instance for cleanup
   */
  subscribeChannel(
    processId: string,
    channelName: string,
    afterSeq: number,
    timeout: number,
    onMessage: (entries: any[]) => void,
    onError: (error: Error) => void,
    onClose: () => void
  ): WebSocket {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey() first.');
    }

    const wsProtocol = this.tls ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${this.host}:${this.port}/pubsub`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const msg = {
        msgtype: 'subscribechannelmsg',
        processid: processId,
        name: channelName,
        afterseq: afterSeq,
        timeout: timeout,
      };

      const rpcMsg = this.createRPCMsg(msg);
      ws.send(JSON.stringify(rpcMsg));
    };

    ws.onmessage = (event) => {
      try {
        const rpcReply = JSON.parse(event.data as string);

        if (rpcReply.error) {
          const errorPayload = JSON.parse(decodeBase64Utf8(rpcReply.payload));
          onError(new Error(errorPayload.message || 'WebSocket error'));
          return;
        }

        const data = JSON.parse(decodeBase64Utf8(rpcReply.payload));

        if (Array.isArray(data)) {
          const entries = data.map((entry) => ({
            ...entry,
            payload:
              typeof entry.payload === 'string'
                ? (() => {
                    try {
                      const binaryStr = atob(entry.payload);
                      const bytes = new Uint8Array(binaryStr.length);
                      for (let i = 0; i < binaryStr.length; i++) {
                        bytes[i] = binaryStr.charCodeAt(i);
                      }
                      return new TextDecoder('utf-8').decode(bytes);
                    } catch {
                      return entry.payload;
                    }
                  })()
                : Array.isArray(entry.payload)
                  ? new TextDecoder('utf-8').decode(new Uint8Array(entry.payload))
                  : entry.payload,
          }));

          const errorEntry = entries.find((e) => e.error);
          if (errorEntry) {
            onError(new Error(errorEntry.error));
            return;
          }

          onMessage(entries);
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.onerror = () => {
      onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      onClose();
    };

    return ws;
  }

  // ==================== Blueprint Definition Methods ====================

  /**
   * Add a blueprint definition
   * @param definition - Blueprint definition object
   */
  async addBlueprintDefinition(definition: any): Promise<any> {
    const msg = {
      msgtype: 'addblueprintdefinitionmsg',
      blueprintdefinition: definition,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Get a blueprint definition by name
   * @param colonyName - Name of the colony
   * @param name - Name of the blueprint definition
   */
  async getBlueprintDefinition(colonyName: string, name: string): Promise<any> {
    const msg = {
      msgtype: 'getblueprintdefinitionmsg',
      colonyname: colonyName,
      name,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Get all blueprint definitions in a colony
   * @param colonyName - Name of the colony
   */
  async getBlueprintDefinitions(colonyName: string): Promise<any[]> {
    const msg = {
      msgtype: 'getblueprintdefinitionsmsg',
      colonyname: colonyName,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Remove a blueprint definition
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint definition to remove
   */
  async removeBlueprintDefinition(colonyName: string, name: string): Promise<void> {
    const msg = {
      msgtype: 'removeblueprintdefinitionmsg',
      namespace: colonyName,
      name,
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }

  // ==================== Blueprint Methods ====================

  /**
   * Add a blueprint instance
   * @param blueprint - Blueprint object
   */
  async addBlueprint(blueprint: any): Promise<any> {
    const msg = {
      msgtype: 'addblueprintmsg',
      blueprint,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Get a blueprint by name
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint
   */
  async getBlueprint(colonyName: string, name: string): Promise<any> {
    const msg = {
      msgtype: 'getblueprintmsg',
      namespace: colonyName,
      name,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Get blueprints in a colony, optionally filtered by kind and location
   * @param colonyName - Name of the colony (namespace)
   * @param kind - Optional kind filter
   * @param location - Optional location filter
   */
  async getBlueprints(colonyName: string, kind?: string, location?: string): Promise<any[]> {
    const msg: any = {
      msgtype: 'getblueprintsmsg',
      namespace: colonyName,
    };
    if (kind) msg.kind = kind;
    if (location) msg.locationname = location;
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Update an existing blueprint
   * @param blueprint - Updated blueprint object
   * @param forceGeneration - Force generation bump even if spec unchanged
   */
  async updateBlueprint(blueprint: any, forceGeneration: boolean = false): Promise<any> {
    const msg = {
      msgtype: 'updateblueprintmsg',
      blueprint,
      forcegeneration: forceGeneration,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Remove a blueprint
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint to remove
   */
  async removeBlueprint(colonyName: string, name: string): Promise<void> {
    const msg = {
      msgtype: 'removeblueprintmsg',
      namespace: colonyName,
      name,
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Update blueprint status (current state)
   * @param colonyName - Name of the colony
   * @param name - Name of the blueprint
   * @param status - Status object representing current state
   */
  async updateBlueprintStatus(colonyName: string, name: string, status: any): Promise<void> {
    const msg = {
      msgtype: 'updateblueprintstatusmsg',
      colonyname: colonyName,
      blueprintname: name,
      status,
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Trigger reconciliation for a blueprint
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint
   * @param force - Force reconciliation even if no changes detected
   */
  async reconcileBlueprint(colonyName: string, name: string, force: boolean = false): Promise<any> {
    const msg = {
      msgtype: 'reconcileblueprintmsg',
      namespace: colonyName,
      name,
      force,
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Get the history of changes for a specific blueprint
   * @param blueprintId - ID of the blueprint
   * @param limit - Optional limit on number of history entries to retrieve
   */
  async getBlueprintHistory(blueprintId: string, limit?: number): Promise<any> {
    const msg: any = {
      msgtype: 'getblueprinthistorymsg',
      blueprintid: blueprintId,
    };
    if (limit !== undefined) {
      msg.limit = limit;
    }
    return this.sendRPC(this.createRPCMsg(msg));
  }

  /**
   * Subscribe to process state changes using WebSocket
   * Use this to wait for a process to be assigned (RUNNING state) before subscribing to channels
   * @param colonyName - Name of the colony
   * @param processId - ID of the process to watch
   * @param state - Target state to wait for (0=WAITING, 1=RUNNING, 2=SUCCESS, 3=FAILED)
   * @param timeout - Timeout in seconds for the subscription
   * @param onProcess - Callback when process reaches the target state
   * @param onError - Callback for errors
   * @param onClose - Callback when connection closes
   * @returns WebSocket instance for cleanup
   */
  subscribeProcess(
    colonyName: string,
    processId: string,
    state: number,
    timeout: number,
    onProcess: (process: any) => void,
    onError: (error: Error) => void,
    onClose: () => void
  ): WebSocket {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey() first.');
    }

    const wsProtocol = this.tls ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${this.host}:${this.port}/pubsub`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const msg = {
        msgtype: 'subscribeprocessmsg',
        colonyname: colonyName,
        processid: processId,
        executortype: '',
        state: state,
        timeout: timeout,
      };

      const rpcMsg = this.createRPCMsg(msg);
      ws.send(JSON.stringify(rpcMsg));
    };

    ws.onmessage = (event) => {
      try {
        const rpcReply = JSON.parse(event.data as string);

        if (rpcReply.error) {
          const errorPayload = JSON.parse(decodeBase64Utf8(rpcReply.payload));
          onError(new Error(errorPayload.message || 'WebSocket error'));
          return;
        }

        const process = JSON.parse(decodeBase64Utf8(rpcReply.payload));
        onProcess(process);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.onerror = () => {
      onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      onClose();
    };

    return ws;
  }
}
