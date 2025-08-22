import { AsyncDisposableBase, DisposableBase } from '@tsdotnet/disposable';
import { BehaviorSubject, Subject } from 'rxjs';
import { WebSocketState } from './interfaces.js';

class VirtualWebSocketConnection extends DisposableBase {
    _connector;
    _sendFn;
    _onDisposeCallback;
    _message$ = new Subject();
    _subscription;
    message$;
    constructor(_connector, _sendFn, _onDisposeCallback) {
        super();
        this._connector = _connector;
        this._sendFn = _sendFn;
        this._onDisposeCallback = _onDisposeCallback;
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
class WebSocketConnectorBase extends AsyncDisposableBase {
    url;
    options;
    _virtualConnections = new Set();
    _state$ = new BehaviorSubject(WebSocketState.Disconnected);
    _error$ = new Subject();
    _message$ = new Subject();
    _idleTimeoutId;
    _currentAttempt = 0;
    state$;
    error$;
    message$;
    _updateState(state) {
        if (this._state$.value !== WebSocketState.Disposing && this._state$.value !== WebSocketState.Disposed) {
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
        if (this._state$.value !== WebSocketState.Connected) {
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
        if (this._state$.value !== WebSocketState.Connected) {
            await this._connect();
        }
        if (this._state$.value !== WebSocketState.Connected) {
            throw new Error('WebSocket failed to connect.');
        }
        await this._sendMessage(data);
    }
    _scheduleIdleDisconnect() {
        if (!this.targetState) {
            return;
        }
        this._cancelIdleDisconnect();
        const idleTimeout = this.options.idleTimeoutMs ?? 10000;
        this._idleTimeoutId = setTimeout(() => {
            this._idleTimeoutId = undefined;
            if (this._virtualConnections.size === 0 && !this.wasDisposed && this._state$.value !== WebSocketState.Disposing) {
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
        this._emitError(error);
        const requestedAttempts = this.options.reconnectAttempts ?? 0;
        const maxAttempts = Math.min(requestedAttempts, 10);
        if (maxAttempts > 0 && this._currentAttempt < maxAttempts && this._virtualConnections.size > 0) {
            this._state$.next(WebSocketState.Reconnecting);
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
            this._state$.next(WebSocketState.Disconnected);
            this._currentAttempt = 0;
        }
    }
    async _connect() {
        if (this._state$.value === WebSocketState.Connected) {
            return;
        }
        const d = this._disconnecting;
        if (d)
            await d;
        this.assertIsAlive();
        this._state$.next(WebSocketState.Connecting);
        try {
            this._state$.next(await this._ensureConnection());
        }
        catch (error) {
            this._state$.next(WebSocketState.Disconnected);
            throw error;
        }
    }
    get targetState() {
        switch (this._state$.value) {
            case WebSocketState.Connecting:
            case WebSocketState.Reconnecting:
            case WebSocketState.Connected:
                return true;
            default:
                return false;
        }
    }
    _disconnecting;
    async _disconnect() {
        const d = this._disconnecting;
        if (d)
            return d;
        this._state$.next(WebSocketState.Disconnecting);
        await (this._disconnecting = this._ensureDisconnect());
        this._disconnecting = null;
        this._state$.next(WebSocketState.Disconnected);
    }
    async _onDisposeAsync() {
        this._message$.complete();
        this._error$.complete();
        await this._disconnect();
        this._state$.next(WebSocketState.Disposing);
        const connections = Array.from(this._virtualConnections);
        for (const connection of connections) {
            connection.dispose();
        }
        this._state$.next(WebSocketState.Disposed);
        this._state$.complete();
    }
}

export { WebSocketConnectorBase };
//# sourceMappingURL=WebSocketConnectorBase.js.map
