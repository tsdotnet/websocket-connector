import WebSocket from 'ws';
import { WebSocketConnectorBase } from './WebSocketConnectorBase.js';
import { WebSocketState } from './interfaces.js';

/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
class NodeWebSocketConnector extends WebSocketConnectorBase {
    createWebSocket() {
        const wsOptions = {};
        if (this.options.headers) {
            wsOptions.headers = this.options.headers;
        }
        if (this.options.protocols) {
            const protocols = Array.isArray(this.options.protocols)
                ? this.options.protocols
                : [this.options.protocols];
            return new WebSocket(this.url, protocols, wsOptions);
        }
        else {
            return new WebSocket(this.url, wsOptions);
        }
    }
    isWebSocketOpen() {
        const ws = this._ws;
        return ws && ws.readyState === WebSocket.OPEN;
    }
    sendWebSocketMessage(data) {
        const ws = this._ws;
        ws.send(data);
    }
    setupWebSocketListeners() {
        const ws = this._ws;
        ws.on('open', () => {
            this.emit('ws-open');
        });
        ws.on('message', (data) => {
            if (Buffer.isBuffer(data)) {
                this.emitMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            }
            else if (data instanceof ArrayBuffer) {
                this.emitMessage(new Uint8Array(data));
            }
            else if (typeof data === 'string') {
                this.emitMessage(data);
            }
            else if (Array.isArray(data)) {
                const totalLength = data.reduce((acc, buf) => acc + buf.length, 0);
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const buf of data) {
                    combined.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), offset);
                    offset += buf.length;
                }
                this.emitMessage(combined);
            }
            else {
                this.emitMessage(String(data));
            }
        });
        ws.on('close', (code, reason) => {
            this.updateState(WebSocketState.Disconnected);
            if (code !== 1000) {
                const error = new Error(`WebSocket closed with code ${code}: ${reason.toString()}`);
                this.emitError(error);
            }
        });
        ws.on('error', (error) => {
            this.updateState(WebSocketState.Disconnected);
            this.emitError(error);
            this.emit('ws-error', error);
        });
    }
    async closeWebSocket() {
        const ws = this._ws;
        if (!ws)
            return;
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
            setTimeout(() => {
                if (ws.readyState !== WebSocket.CLOSED) {
                    ws.terminate();
                    cleanup();
                }
            }, 5000);
        });
    }
}

export { NodeWebSocketConnector };
//# sourceMappingURL=NodeWebSocketConnector.js.map
