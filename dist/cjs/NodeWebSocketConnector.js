"use strict";
/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeWebSocketConnector = void 0;
const tslib_1 = require("tslib");
const ws_1 = tslib_1.__importDefault(require("ws"));
const interfaces_1 = require("./interfaces");
const WebSocketConnectorBase_1 = require("./WebSocketConnectorBase");
class NodeWebSocketConnector extends WebSocketConnectorBase_1.WebSocketConnectorBase {
    constructor(url, options) {
        super(url, options);
    }
    async _ensureConnection() {
        var _a, _b;
        if (((_a = this._webSocket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
            return interfaces_1.WebSocketState.Connected;
        }
        if (((_b = this._webSocket) === null || _b === void 0 ? void 0 : _b.readyState) === ws_1.default.CONNECTING) {
            return interfaces_1.WebSocketState.Connecting;
        }
        return this._connectWebSocket();
    }
    async _sendMessage(data) {
        if (!this._webSocket || this._webSocket.readyState !== ws_1.default.OPEN) {
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
        if (!this._webSocket || this._webSocket.readyState === ws_1.default.CLOSED) {
            return;
        }
        return new Promise((resolve) => {
            if (!this._webSocket) {
                resolve();
                return;
            }
            if (this._webSocket.readyState === ws_1.default.CLOSED) {
                resolve();
                return;
            }
            const cleanup = () => {
                var _a;
                (_a = this._webSocket) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
                resolve();
            };
            this._webSocket.once('close', cleanup);
            this._webSocket.close(1000, 'Normal closure');
            setTimeout(() => {
                if (this._webSocket && this._webSocket.readyState !== ws_1.default.CLOSED) {
                    this._webSocket.terminate();
                    cleanup();
                }
            }, 5000);
        });
    }
    async _connectWebSocket() {
        return new Promise((resolve, reject) => {
            var _a, _b;
            const wsOptions = {};
            if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.headers) {
                wsOptions.headers = this.options.headers;
            }
            const ws = ((_b = this.options) === null || _b === void 0 ? void 0 : _b.protocols)
                ? new ws_1.default(this.url, this.options.protocols, wsOptions)
                : new ws_1.default(this.url, wsOptions);
            this._webSocket = ws;
            ws.on('open', () => {
                this._updateState(interfaces_1.WebSocketState.Connected);
                resolve(interfaces_1.WebSocketState.Connected);
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
                    this._updateState(interfaces_1.WebSocketState.Disconnected);
                }
            });
            ws.on('error', (error) => {
                this._handleConnectionFailure(error);
                reject(error);
            });
            this._updateState(interfaces_1.WebSocketState.Connecting);
        });
    }
    _onDisposeAsync() {
        return this._ensureDisconnect();
    }
}
exports.NodeWebSocketConnector = NodeWebSocketConnector;
//# sourceMappingURL=NodeWebSocketConnector.js.map