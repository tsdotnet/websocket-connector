"use strict";
/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserWebSocketConnector = void 0;
const interfaces_1 = require("./interfaces");
const WebSocketConnectorBase_1 = require("./WebSocketConnectorBase");
class BrowserWebSocketConnector extends WebSocketConnectorBase_1.WebSocketConnectorBase {
    constructor(url, options) {
        super(url, options);
    }
    async _ensureConnection() {
        var _a, _b;
        if (((_a = this._webSocket) === null || _a === void 0 ? void 0 : _a.readyState) === WebSocket.OPEN) {
            return interfaces_1.WebSocketState.Connected;
        }
        if (((_b = this._webSocket) === null || _b === void 0 ? void 0 : _b.readyState) === WebSocket.CONNECTING) {
            return interfaces_1.WebSocketState.Connecting;
        }
        return this._connectWebSocket();
    }
    async _sendMessage(data) {
        if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }
        this._webSocket.send(data);
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
                var _a;
                (_a = this._webSocket) === null || _a === void 0 ? void 0 : _a.removeEventListener('close', onClose);
                resolve();
            };
            const onClose = () => cleanup();
            this._webSocket.addEventListener('close', onClose);
            this._webSocket.close(1000, 'Normal closure');
            setTimeout(() => {
                if (this._webSocket && this._webSocket.readyState !== WebSocket.CLOSED) {
                    cleanup();
                }
            }, 5000);
        });
    }
    async _connectWebSocket() {
        return new Promise((resolve, reject) => {
            var _a;
            const ws = ((_a = this.options) === null || _a === void 0 ? void 0 : _a.protocols)
                ? new WebSocket(this.url, this.options.protocols)
                : new WebSocket(this.url);
            this._webSocket = ws;
            const onOpen = () => {
                cleanup();
                this._updateState(interfaces_1.WebSocketState.Connected);
                resolve(interfaces_1.WebSocketState.Connected);
            };
            const onMessage = (event) => {
                let message;
                if (event.data instanceof ArrayBuffer) {
                    message = new Uint8Array(event.data);
                }
                else if (event.data instanceof Blob) {
                    event.data.text().then(text => this._emitMessage(text));
                    return;
                }
                else if (typeof event.data === 'string') {
                    message = event.data;
                }
                else {
                    message = String(event.data);
                }
                this._emitMessage(message);
            };
            const onClose = (event) => {
                cleanup();
                this._updateState(interfaces_1.WebSocketState.Disconnected);
                if (event.code !== 1000) {
                    const error = new Error(`WebSocket closed with code ${event.code}: ${event.reason}`);
                    this._emitError(error);
                }
            };
            const onError = () => {
                cleanup();
                this._updateState(interfaces_1.WebSocketState.Disconnected);
                const error = new Error('WebSocket connection error');
                this._emitError(error);
                reject(error);
            };
            const cleanup = () => {
                ws.removeEventListener('open', onOpen);
                ws.removeEventListener('message', onMessage);
                ws.removeEventListener('close', onClose);
                ws.removeEventListener('error', onError);
            };
            ws.addEventListener('open', onOpen);
            ws.addEventListener('message', onMessage);
            ws.addEventListener('close', onClose);
            ws.addEventListener('error', onError);
            this._updateState(interfaces_1.WebSocketState.Connecting);
        });
    }
    _onDisposeAsync() {
        return this._ensureDisconnect();
    }
}
exports.BrowserWebSocketConnector = BrowserWebSocketConnector;
//# sourceMappingURL=BrowserWebSocketConnector.js.map