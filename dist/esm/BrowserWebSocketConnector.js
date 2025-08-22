import { WebSocketState } from './interfaces.js';
import { WebSocketConnectorBase } from './WebSocketConnectorBase.js';

/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
class BrowserWebSocketConnector extends WebSocketConnectorBase {
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
                this._webSocket?.removeEventListener('close', onClose);
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
            const ws = this.options?.protocols
                ? new WebSocket(this.url, this.options.protocols)
                : new WebSocket(this.url);
            this._webSocket = ws;
            const onOpen = () => {
                cleanup();
                this._updateState(WebSocketState.Connected);
                resolve(WebSocketState.Connected);
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
                this._updateState(WebSocketState.Disconnected);
                if (event.code !== 1000) {
                    const error = new Error(`WebSocket closed with code ${event.code}: ${event.reason}`);
                    this._emitError(error);
                }
            };
            const onError = (event) => {
                cleanup();
                this._updateState(WebSocketState.Disconnected);
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
            this._updateState(WebSocketState.Connecting);
        });
    }
    _onDisposeAsync() {
        return this._ensureDisconnect();
    }
}

export { BrowserWebSocketConnector };
//# sourceMappingURL=BrowserWebSocketConnector.js.map
