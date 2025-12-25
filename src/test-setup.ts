// Polyfill WebSocket for Node.js environment
import WebSocket from 'ws';

// @ts-expect-error - Adding WebSocket to global for Node.js
globalThis.WebSocket = WebSocket;
