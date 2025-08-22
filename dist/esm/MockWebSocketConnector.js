import { WebSocketConnectorBase } from './WebSocketConnectorBase.js';
import { WebSocketState } from './interfaces.js';

class MockWebSocket {
    onopen;
    onmessage;
    onclose;
    onerror;
    readyState = 0;
    send(data) {
        if (this.readyState !== 1) {
            throw new Error('WebSocket is not open');
        }
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({ data });
            }
        }, 1);
    }
    close() {
        this.readyState = 2;
        setTimeout(() => {
            this.readyState = 3;
            if (this.onclose)
                this.onclose();
        }, 1);
    }
    simulateOpen() {
        this.readyState = 1;
        setTimeout(() => {
            if (this.onopen)
                this.onopen();
        }, 1);
    }
    simulateMessage(message) {
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({ data: message });
            }
        }, 1);
    }
    simulateError(error) {
        setTimeout(() => {
            if (this.onerror)
                this.onerror(error);
            this.readyState = 3;
            if (this.onclose)
                this.onclose();
        }, 1);
    }
    simulateClose() {
        this.readyState = 3;
        setTimeout(() => {
            if (this.onclose)
                this.onclose();
        }, 1);
    }
    simulateConnectionFailure() {
        this.simulateError(new Error('Network failure'));
    }
}
class MockWebSocketConnector extends WebSocketConnectorBase {
    mockWs;
    async _ensureConnection() {
        if (this.mockWs?.readyState === 1) {
            return WebSocketState.Connected;
        }
        if (this.mockWs?.readyState === 0) {
            return new Promise((resolve) => {
                const checkConnection = () => {
                    if (this.mockWs?.readyState === 1) {
                        resolve(WebSocketState.Connected);
                    }
                    else {
                        setTimeout(checkConnection, 1);
                    }
                };
                checkConnection();
            });
        }
        return this._connectWebSocket();
    }
    async _sendMessage(data) {
        if (!this.mockWs || this.mockWs.readyState !== 1) {
            throw new Error('WebSocket not connected');
        }
        this.mockWs.send(data);
    }
    async _ensureDisconnect() {
        if (this.mockWs && this.mockWs.readyState !== 3) {
            this.mockWs.close();
            return new Promise(resolve => {
                const checkClosed = () => {
                    if (!this.mockWs || this.mockWs.readyState === 3) {
                        resolve();
                    }
                    else {
                        setTimeout(checkClosed, 1);
                    }
                };
                checkClosed();
            });
        }
    }
    async _connectWebSocket() {
        return new Promise((resolve) => {
            this.mockWs = new MockWebSocket();
            this._setupWebSocketListeners();
            setTimeout(() => {
                if (this.mockWs) {
                    this.mockWs.simulateOpen();
                    resolve(WebSocketState.Connected);
                }
            }, 5);
        });
    }
    _setupWebSocketListeners() {
        if (!this.mockWs)
            return;
        this.mockWs.onopen = () => {
        };
        this.mockWs.onmessage = (event) => {
            this._emitMessage(event.data);
        };
        this.mockWs.onclose = () => {
            this._updateState(WebSocketState.Disconnected);
        };
        this.mockWs.onerror = (error) => {
            this._emitError(error);
        };
    }
    simulateConnection() {
        if (this.mockWs) {
            this.mockWs.simulateOpen();
        }
    }
    simulateMessage(message) {
        if (this.mockWs) {
            this.mockWs.simulateMessage(message);
        }
    }
    simulateError(error) {
        if (this.mockWs) {
            this.mockWs.simulateError(error);
        }
    }
    simulateDisconnection() {
        if (this.mockWs) {
            this.mockWs.simulateClose();
        }
    }
    simulateConnectionFailure() {
        if (this.mockWs) {
            this.mockWs.simulateError(new Error('Network failure'));
        }
    }
    get mockConnection() {
        return this.mockWs;
    }
}

export { MockWebSocket, MockWebSocketConnector };
//# sourceMappingURL=MockWebSocketConnector.js.map
