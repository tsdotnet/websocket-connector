"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketConnectorBase = void 0;
const disposable_1 = require("@tsdotnet/disposable");
const rxjs_1 = require("rxjs");
const interfaces_1 = require("./interfaces");
class VirtualWebSocketConnection extends disposable_1.DisposableBase {
    constructor(_connector, _sendFn, _onDisposeCallback) {
        super();
        this._connector = _connector;
        this._sendFn = _sendFn;
        this._onDisposeCallback = _onDisposeCallback;
        this._message$ = new rxjs_1.Subject();
        this.message$ = this._message$.asObservable();
        this._subscription = this._connector.message$.subscribe({
            next: (message) => this._message$.next(message),
            complete: () => this._message$.complete()
        });
    }
    async send(data) {
        this.assertIsAlive();
        await this._sendFn(data);
    }
    subscribe(observer) {
        return this.message$.subscribe(observer);
    }
    _onDispose() {
        this._subscription.unsubscribe();
        this._message$.complete();
        this._onDisposeCallback();
    }
}
class WebSocketConnectorBase extends disposable_1.AsyncDisposableBase {
    _updateState(state) {
        if (this._state$.value !== interfaces_1.WebSocketState.Disposing && this._state$.value !== interfaces_1.WebSocketState.Disposed) {
            this._state$.next(state);
        }
    }
    _emitError(error) {
        this._error$.next(error);
    }
    _emitMessage(message) {
        this._message$.next(message);
    }
    constructor(url, options = {}) {
        super();
        this.url = url;
        this.options = options;
        this._virtualConnections = new Set();
        this._state$ = new rxjs_1.BehaviorSubject(interfaces_1.WebSocketState.Disconnected);
        this._error$ = new rxjs_1.Subject();
        this._message$ = new rxjs_1.Subject();
        this._currentAttempt = 0;
        this.state$ = this._state$.asObservable();
        this.error$ = this._error$.asObservable();
        this.message$ = this._message$.asObservable();
    }
    get activeVirtualConnections() {
        return this._virtualConnections.size;
    }
    async connect() {
        this.assertIsAlive();
        this._cancelIdleDisconnect();
        if (this._state$.value !== interfaces_1.WebSocketState.Connected) {
            await this._connect();
        }
        const virtualConnection = new VirtualWebSocketConnection(this, (data) => this._send(data), () => {
            this._virtualConnections.delete(virtualConnection);
            if (this._virtualConnections.size === 0) {
                this._scheduleIdleDisconnect();
            }
        });
        this._virtualConnections.add(virtualConnection);
        return virtualConnection;
    }
    async _send(data) {
        this.assertIsAlive();
        if (this._state$.value !== interfaces_1.WebSocketState.Connected) {
            await this._connect();
        }
        if (this._state$.value !== interfaces_1.WebSocketState.Connected) {
            throw new Error('WebSocket failed to connect.');
        }
        await this._sendMessage(data);
    }
    _scheduleIdleDisconnect() {
        var _a;
        if (!this.targetState) {
            return;
        }
        this._cancelIdleDisconnect();
        const idleTimeout = (_a = this.options.idleTimeoutMs) !== null && _a !== void 0 ? _a : 10000;
        this._idleTimeoutId = setTimeout(() => {
            this._idleTimeoutId = undefined;
            if (this._virtualConnections.size === 0 && !this.wasDisposed && this._state$.value !== interfaces_1.WebSocketState.Disposing) {
                this._disconnect();
            }
        }, idleTimeout);
    }
    _cancelIdleDisconnect() {
        const t = this._idleTimeoutId;
        if (t !== undefined) {
            this._idleTimeoutId = undefined;
            clearTimeout(t);
        }
    }
    _handleConnectionFailure(error) {
        var _a;
        this._emitError(error);
        const requestedAttempts = (_a = this.options.reconnectAttempts) !== null && _a !== void 0 ? _a : 0;
        const maxAttempts = Math.min(requestedAttempts, 10);
        if (maxAttempts > 0 && this._currentAttempt < maxAttempts && this._virtualConnections.size > 0) {
            this._state$.next(interfaces_1.WebSocketState.Reconnecting);
            this._currentAttempt++;
            const delay = Math.min(1000 * Math.pow(2, this._currentAttempt - 1), 30000);
            setTimeout(async () => {
                if (this._virtualConnections.size > 0 && !this.wasDisposed) {
                    try {
                        await this._connect();
                        this._currentAttempt = 0;
                    }
                    catch (reconnectError) {
                        this._handleConnectionFailure(reconnectError);
                    }
                }
            }, delay);
        }
        else {
            this._state$.next(interfaces_1.WebSocketState.Disconnected);
            this._currentAttempt = 0;
        }
    }
    async _connect() {
        if (this._state$.value === interfaces_1.WebSocketState.Connected) {
            return;
        }
        const d = this._disconnecting;
        if (d)
            await d;
        this.assertIsAlive();
        this._state$.next(interfaces_1.WebSocketState.Connecting);
        try {
            this._state$.next(await this._ensureConnection());
        }
        catch (error) {
            this._state$.next(interfaces_1.WebSocketState.Disconnected);
            throw error;
        }
    }
    get targetState() {
        switch (this._state$.value) {
            case interfaces_1.WebSocketState.Connecting:
            case interfaces_1.WebSocketState.Reconnecting:
            case interfaces_1.WebSocketState.Connected:
                return true;
            default:
                return false;
        }
    }
    async _disconnect() {
        const d = this._disconnecting;
        if (d)
            return d;
        this._state$.next(interfaces_1.WebSocketState.Disconnecting);
        await (this._disconnecting = this._ensureDisconnect());
        this._disconnecting = null;
        this._state$.next(interfaces_1.WebSocketState.Disconnected);
    }
    async _onDisposeAsync() {
        this._message$.complete();
        this._error$.complete();
        await this._disconnect();
        this._state$.next(interfaces_1.WebSocketState.Disposing);
        const connections = Array.from(this._virtualConnections);
        for (const connection of connections) {
            connection.dispose();
        }
        this._state$.next(interfaces_1.WebSocketState.Disposed);
        this._state$.complete();
    }
}
exports.WebSocketConnectorBase = WebSocketConnectorBase;
//# sourceMappingURL=WebSocketConnectorBase.js.map