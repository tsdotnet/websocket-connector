"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWebSocketConnector = exports.MockWebSocket = void 0;
const WebSocketConnectorBase_1 = require("./WebSocketConnectorBase");
const interfaces_1 = require("./interfaces");
class MockWebSocket {
    constructor() {
        this.readyState = 0;
    }
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
exports.MockWebSocket = MockWebSocket;
class MockWebSocketConnector extends WebSocketConnectorBase_1.WebSocketConnectorBase {
    async _ensureConnection() {
        var _a, _b;
        if (((_a = this.mockWs) === null || _a === void 0 ? void 0 : _a.readyState) === 1) {
            return interfaces_1.WebSocketState.Connected;
        }
        if (((_b = this.mockWs) === null || _b === void 0 ? void 0 : _b.readyState) === 0) {
            return new Promise((resolve) => {
                const checkConnection = () => {
                    var _a;
                    if (((_a = this.mockWs) === null || _a === void 0 ? void 0 : _a.readyState) === 1) {
                        resolve(interfaces_1.WebSocketState.Connected);
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
                    resolve(interfaces_1.WebSocketState.Connected);
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
            this._updateState(interfaces_1.WebSocketState.Disconnected);
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
exports.MockWebSocketConnector = MockWebSocketConnector;
//# sourceMappingURL=MockWebSocketConnector.js.map