import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ColoniesClient } from './client';

// Helper to decode base64 payload
function decodePayload(base64: string): any {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const jsonStr = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(jsonStr);
}

// Helper to create mock response
function createMockResponse(data: any): Response {
  const payload = btoa(JSON.stringify(data));
  return new Response(JSON.stringify({ payload, error: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ColoniesClient', () => {
  let client: ColoniesClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new ColoniesClient({
      host: 'localhost',
      port: 50080,
      tls: false,
    });
    client.setPrivateKey('ddf7f7791208083b6a9ed975a72684f6406a269cfa36f1b1c32045c0a71fff05');
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Blueprint Definition Methods', () => {
    it('should call addBlueprintDefinition with correct message type', async () => {
      const definition = {
        kind: 'HomeDevice',
        metadata: { name: 'device-def', colonyname: 'test' },
      };
      fetchSpy.mockResolvedValueOnce(createMockResponse(definition));

      await client.addBlueprintDefinition(definition);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://localhost:50080/api');
      const body = JSON.parse(options!.body as string);
      expect(body.payloadtype).toBe('addblueprintdefinitionmsg');
      const payload = decodePayload(body.payload);
      expect(payload.msgtype).toBe('addblueprintdefinitionmsg');
      expect(payload.blueprintdefinition).toEqual(definition);
    });

    it('should call getBlueprintDefinition with correct parameters', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ kind: 'HomeDevice' }));

      await client.getBlueprintDefinition('test', 'device-def');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('getblueprintdefinitionmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('device-def');
    });

    it('should call getBlueprintDefinitions with correct colony name', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await client.getBlueprintDefinitions('test');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('getblueprintdefinitionsmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
    });

    it('should call removeBlueprintDefinition with correct parameters', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({}));

      await client.removeBlueprintDefinition('test', 'device-def');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('removeblueprintdefinitionmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('device-def');
    });
  });

  describe('Blueprint Methods', () => {
    it('should call addBlueprint with correct message', async () => {
      const blueprint = {
        kind: 'HomeDevice',
        metadata: { name: 'living-room-light', colonyname: 'test' },
        handler: { executortype: 'home-reconciler' },
        spec: { power: true, brightness: 80 },
      };
      fetchSpy.mockResolvedValueOnce(createMockResponse(blueprint));

      await client.addBlueprint(blueprint);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('addblueprintmsg');
      const payload = decodePayload(body.payload);
      expect(payload.blueprint).toEqual(blueprint);
    });

    it('should call getBlueprint with correct parameters', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ kind: 'HomeDevice' }));

      await client.getBlueprint('test', 'living-room-light');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('getblueprintmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('living-room-light');
    });

    it('should call getBlueprints with optional filters', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await client.getBlueprints('test', 'HomeDevice', 'living-room');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('getblueprintsmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.kind).toBe('HomeDevice');
      expect(payload.location).toBe('living-room');
    });

    it('should call getBlueprints without filters when not provided', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await client.getBlueprints('test');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.kind).toBeUndefined();
      expect(payload.location).toBeUndefined();
    });

    it('should call updateBlueprint with forceGeneration flag', async () => {
      const blueprint = {
        kind: 'HomeDevice',
        metadata: { name: 'living-room-light', colonyname: 'test' },
        spec: { power: false },
      };
      fetchSpy.mockResolvedValueOnce(createMockResponse(blueprint));

      await client.updateBlueprint(blueprint, true);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('updateblueprintmsg');
      const payload = decodePayload(body.payload);
      expect(payload.blueprint).toEqual(blueprint);
      expect(payload.forcegeneration).toBe(true);
    });

    it('should call updateBlueprint without forceGeneration by default', async () => {
      const blueprint = { metadata: { name: 'test' } };
      fetchSpy.mockResolvedValueOnce(createMockResponse(blueprint));

      await client.updateBlueprint(blueprint);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      const payload = decodePayload(body.payload);
      expect(payload.forcegeneration).toBe(false);
    });

    it('should call removeBlueprint with correct parameters', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({}));

      await client.removeBlueprint('test', 'living-room-light');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('removeblueprintmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('living-room-light');
    });

    it('should call updateBlueprintStatus with status object', async () => {
      const status = {
        power: true,
        brightness: 80,
        lastSeen: '2024-01-01T12:00:00Z',
      };
      fetchSpy.mockResolvedValueOnce(createMockResponse({}));

      await client.updateBlueprintStatus('test', 'living-room-light', status);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('updateblueprintstatusmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('living-room-light');
      expect(payload.status).toEqual(status);
    });

    it('should call reconcileBlueprint with force flag', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ processid: 'abc123' }));

      await client.reconcileBlueprint('test', 'living-room-light', true);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.payloadtype).toBe('reconcileblueprintmsg');
      const payload = decodePayload(body.payload);
      expect(payload.colonyname).toBe('test');
      expect(payload.name).toBe('living-room-light');
      expect(payload.force).toBe(true);
    });

    it('should call reconcileBlueprint without force by default', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ processid: 'abc123' }));

      await client.reconcileBlueprint('test', 'living-room-light');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      const payload = decodePayload(body.payload);
      expect(payload.force).toBe(false);
    });
  });

  describe('Client Configuration', () => {
    it('should use https when tls is enabled', async () => {
      const tlsClient = new ColoniesClient({
        host: 'localhost',
        port: 443,
        tls: true,
      });
      tlsClient.setPrivateKey('ddf7f7791208083b6a9ed975a72684f6406a269cfa36f1b1c32045c0a71fff05');
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await tlsClient.getBlueprints('test');

      expect(fetchSpy.mock.calls[0][0]).toBe('https://localhost:443/api');
    });

    it('should throw error when private key not set', async () => {
      const noKeyClient = new ColoniesClient({
        host: 'localhost',
        port: 50080,
      });

      await expect(noKeyClient.getBlueprints('test')).rejects.toThrow('Private key not set');
    });
  });
});
