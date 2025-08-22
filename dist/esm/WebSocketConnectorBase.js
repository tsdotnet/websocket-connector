import { AsyncDisposableBase, DisposableBase } from '@tsdotnet/disposable';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WebSocketState } from './interfaces.js';

class VirtualWebSocketConnection extends DisposableBase {
    _connector;
    _onDisposeCallback;
    _message$ = new Subject();
    _dispose$ = new Subject();
    message$;
    constructor(_connector, _onDisposeCallback) {
        super();
        this._connector = _connector;
        this._onDisposeCallback = _onDisposeCallback;
        this.message$ = this._message$.asObservable();
        this._connector.message$.pipe(takeUntil(this._dispose$)).subscribe({
            next: (message) => this._message$.next(message),
            complete: () => this._message$.complete()
        });
    }
    send(data) {
        if (this.wasDisposed) {
            throw new Error('Cannot send data through disposed connection');
        }
        this._connector.send(data);
    }
    _onDispose() {
        this._dispose$.next();
        this._dispose$.complete();
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
    _ws = undefined;
    constructor(url, options = {}) {
        super();
        this.url = url;
        this.options = options;
    }
    get state$() {
        return this._state$.asObservable();
    }
    get error$() {
        return this._error$.asObservable();
    }
    get message$() {
        return this._message$.asObservable();
    }
    get activeVirtualConnections() {
        return this._virtualConnections.size;
    }
    async connect() {
        if (this.wasDisposed || this._state$.value === WebSocketState.Disposing) {
            throw new Error('Cannot create connections from disposed connector');
        }
        if (!this._ws) {
            await this._ensureWebSocket();
        }
        const virtualConnection = new VirtualWebSocketConnection(this, () => {
            this._virtualConnections.delete(virtualConnection);
            if (this._virtualConnections.size === 0 && !this.wasDisposed && this._state$.value !== WebSocketState.Disposing) {
                this._disconnectWebSocket();
            }
        });
        this._virtualConnections.add(virtualConnection);
        return virtualConnection;
    }
    send(data) {
        if (!this._ws || !this.isWebSocketOpen()) {
            throw new Error('WebSocket is not connected');
        }
        this.sendWebSocketMessage(data);
    }
    updateState(state) {
        if (this._state$.value !== WebSocketState.Disposing && this._state$.value !== WebSocketState.Disposed) {
            this._state$.next(state);
        }
    }
    emitError(error) {
        this._error$.next(error);
    }
    emitMessage(message) {
        this._message$.next(message);
    }
    async _ensureWebSocket() {
        if (this._ws) {
            return;
        }
        this._state$.next(WebSocketState.Connecting);
        try {
            this._ws = this.createWebSocket();
            this.setupWebSocketListeners();
            await new Promise((resolve, reject) => {
                const timeout = this.options.idleTimeout;
                let timeoutId;
                const cleanup = () => {
                    if (timeoutId)
                        clearTimeout(timeoutId);
                };
                const onOpen = () => {
                    cleanup();
                    this._state$.next(WebSocketState.Connected);
                    resolve();
                };
                const onError = (error) => {
                    cleanup();
                    this._state$.next(WebSocketState.Disconnected);
                    reject(error);
                };
                this.once('ws-open', onOpen);
                this.once('ws-error', onError);
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        this.off('ws-open', onOpen);
                        this.off('ws-error', onError);
                        onError(new Error('Connection timeout'));
                    }, timeout);
                }
            });
        }
        catch (error) {
            this._state$.next(WebSocketState.Disconnected);
            delete this._ws;
            throw error;
        }
    }
    async _disconnectWebSocket() {
        if (!this._ws) {
            return;
        }
        this._state$.next(WebSocketState.Disconnecting);
        try {
            await this.closeWebSocket();
        }
        finally {
            delete this._ws;
            if (this._state$.value !== WebSocketState.Disposing) {
                this._state$.next(WebSocketState.Disconnected);
            }
        }
    }
    async _onDisposeAsync() {
        this._state$.next(WebSocketState.Disposing);
        const connections = Array.from(this._virtualConnections);
        for (const connection of connections) {
            connection.dispose();
        }
        this._virtualConnections.clear();
        if (this._ws) {
            await this._disconnectWebSocket();
        }
        this._state$.next(WebSocketState.Disposed);
        this._state$.complete();
        this._error$.complete();
        this._message$.complete();
    }
    _eventHandlers = new Map();
    emit(event, ...args) {
        const handlers = this._eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(...args));
        }
    }
    once(event, handler) {
        const onceHandler = (...args) => {
            handler(...args);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
    on(event, handler) {
        if (!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, []);
        }
        this._eventHandlers.get(event).push(handler);
    }
    off(event, handler) {
        const handlers = this._eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
}

export { WebSocketConnectorBase };
//# sourceMappingURL=WebSocketConnectorBase.js.map
