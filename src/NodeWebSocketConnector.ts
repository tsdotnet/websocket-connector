/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */

import WebSocket from 'ws';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from './interfaces';

/**
 * Node.js WebSocket connector implementation
 * Uses the 'ws' library for WebSocket connections
 */
export class NodeWebSocketConnector extends WebSocketConnectorBase {
  
  protected createWebSocket(): WebSocket {
    const wsOptions: WebSocket.ClientOptions = {};

    if (this.options.headers) {
      wsOptions.headers = this.options.headers;
    }

    if (this.options.protocols) {
      const protocols = Array.isArray(this.options.protocols) 
        ? this.options.protocols 
        : [this.options.protocols];
      return new WebSocket(this.url, protocols, wsOptions);
    } else {
      return new WebSocket(this.url, wsOptions);
    }
  }

  protected isWebSocketOpen(): boolean {
    const ws = this._ws as WebSocket;
    return ws && ws.readyState === WebSocket.OPEN;
  }

  protected sendWebSocketMessage(data: WebSocketMessage): void {
    const ws = this._ws as WebSocket;
    ws.send(data);
  }

  protected setupWebSocketListeners(): void {
    const ws = this._ws as WebSocket;

    ws.on('open', () => {
      this.emit('ws-open');
    });

    ws.on('message', (data: WebSocket.RawData) => {
      // Convert different data types to consistent format
      if (Buffer.isBuffer(data)) {
        this.emitMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      } else if (data instanceof ArrayBuffer) {
        this.emitMessage(new Uint8Array(data));
      } else if (typeof data === 'string') {
        this.emitMessage(data);
      } else if (Array.isArray(data)) {
        // Handle array of Buffers by concatenating
        const totalLength = data.reduce((acc, buf) => acc + buf.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of data) {
          combined.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), offset);
          offset += buf.length;
        }
        this.emitMessage(combined);
      } else {
        // Fallback for other types
        this.emitMessage(String(data));
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.updateState(WebSocketState.Disconnected);
      
      if (code !== 1000) { // Not a normal closure
        const error = new Error(`WebSocket closed with code ${code}: ${reason.toString()}`);
        this.emitError(error);
      }
    });

    ws.on('error', (error: Error) => {
      this.updateState(WebSocketState.Disconnected);
      this.emitError(error);
      this.emit('ws-error', error);
    });
  }

  protected async closeWebSocket(): Promise<void> {
    const ws = this._ws as WebSocket;
    if (!ws) return;

    return new Promise((resolve) => {
      const cleanup = () => {
        ws.removeAllListeners();
        resolve();
      };

      if (ws.readyState === WebSocket.CLOSED) {
        cleanup();
        return;
      }

      if (ws.readyState === WebSocket.CLOSING) {
        ws.on('close', cleanup);
        return;
      }

      ws.on('close', cleanup);
      ws.close(1000, 'Normal closure');

      // Force close after timeout
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.terminate();
          cleanup();
        }
      }, 5000);
    });
  }
}
