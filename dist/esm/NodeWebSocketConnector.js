import WebSocket from 'ws';
import { WebSocketState } from './interfaces.js';
import { WebSocketConnectorBase } from './WebSocketConnectorBase.js';

/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
class NodeWebSocketConnector extends WebSocketConnectorBase {
    _webSocket;
    constructor(url, options) {
        super(url, options);
    }
    async _ensureConnection() {
        if (this._webSocket?.readyState === WebSocket.OPEN) {
            return WebSocketState.Connected;
        }
        if (this._webSocket?.readyState === WebSocket.CONNECTING) {
            return WebSocketState.Connecting;
        }
        return this._connectWebSocket();
    }
    async _sendMessage(data) {
        if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }
        return new Promise((resolve, reject) => {
            this._webSocket.send(data, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    async _ensureDisconnect() {
        if (!this._webSocket || this._webSocket.readyState === WebSocket.CLOSED) {
            return;
        }
        return new Promise((resolve) => {
            if (!this._webSocket) {
                resolve();
                return;
            }
            if (this._webSocket.readyState === WebSocket.CLOSED) {
                resolve();
                return;
            }
            const cleanup = () => {
                this._webSocket?.removeAllListeners();
                resolve();
            };
            this._webSocket.once('close', cleanup);
            this._webSocket.close(1000, 'Normal closure');
            setTimeout(() => {
                if (this._webSocket && this._webSocket.readyState !== WebSocket.CLOSED) {
                    this._webSocket.terminate();
                    cleanup();
                }
            }, 5000);
        });
    }
    async _connectWebSocket() {
        return new Promise((resolve, reject) => {
            const wsOptions = {};
            if (this.options?.headers) {
                wsOptions.headers = this.options.headers;
            }
            const ws = this.options?.protocols
                ? new WebSocket(this.url, this.options.protocols, wsOptions)
                : new WebSocket(this.url, wsOptions);
            this._webSocket = ws;
            ws.on('open', () => {
                this._updateState(WebSocketState.Connected);
                resolve(WebSocketState.Connected);
            });
            ws.on('message', (data) => {
                let message;
                if (Buffer.isBuffer(data)) {
                    message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                }
                else if (data instanceof ArrayBuffer) {
                    message = new Uint8Array(data);
                }
                else if (typeof data === 'string') {
                    message = data;
                }
                else if (Array.isArray(data)) {
                    const totalLength = data.reduce((acc, buf) => acc + buf.length, 0);
                    const combined = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const buf of data) {
                        combined.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), offset);
                        offset += buf.length;
                    }
                    message = combined;
                }
                else {
                    message = String(data);
                }
                this._emitMessage(message);
            });
            ws.on('close', (code, reason) => {
                if (code !== 1000) {
                    const error = new Error(`WebSocket closed with code ${code}: ${reason.toString()}`);
                    this._handleConnectionFailure(error);
                }
                else {
                    this._updateState(WebSocketState.Disconnected);
                }
            });
            ws.on('error', (error) => {
                this._handleConnectionFailure(error);
                reject(error);
            });
            this._updateState(WebSocketState.Connecting);
        });
    }
    _onDisposeAsync() {
        return this._ensureDisconnect();
    }
}

export { NodeWebSocketConnector };
//# sourceMappingURL=NodeWebSocketConnector.js.map
