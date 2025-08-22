import { AsyncDisposableBase, DisposableBase } from '@tsdotnet/disposable';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WebSocketConnector, WebSocketConnection, WebSocketMessage, WebSocketOptions, WebSocketState } from './interfaces.js';

/**
 * Virtual WebSocket connection that wraps the connector's underlying WebSocket
 * Multiple virtual connections can share the same underlying WebSocket
 */
class VirtualWebSocketConnection extends DisposableBase implements WebSocketConnection {
  private readonly _message$ = new Subject<WebSocketMessage>();
  private readonly _dispose$ = new Subject<void>();

  readonly message$: Observable<WebSocketMessage>;

  constructor(
    private readonly _connector: WebSocketConnectorBase,
    private readonly _onDisposeCallback: () => void
  ) {
    super();
    
    this.message$ = this._message$.asObservable();
    
    // Forward messages from connector to this virtual connection
    this._connector.message$.pipe(
      takeUntil(this._dispose$)
    ).subscribe({
      next: (message) => this._message$.next(message),
      complete: () => this._message$.complete()
    });
  }

  send(data: WebSocketMessage): void {
    if (this.wasDisposed) {
      throw new Error('Cannot send data through disposed connection');
    }
    this._connector.send(data);
  }

  protected _onDispose(): void {
    this._dispose$.next();
    this._dispose$.complete();
    this._message$.complete();
    this._onDisposeCallback();
  }
}

/**
 * Abstract base class for WebSocket connector implementations
 * Handles all the connection logic, virtual connections, and observables
 * Subclasses only need to implement WebSocket creation/management
 */
export abstract class WebSocketConnectorBase extends AsyncDisposableBase implements WebSocketConnector {
  private readonly _virtualConnections = new Set<VirtualWebSocketConnection>();
  private readonly _state$ = new BehaviorSubject<WebSocketState>(WebSocketState.Disconnected);
  private readonly _error$ = new Subject<Error>();
  private readonly _message$ = new Subject<WebSocketMessage>();
  protected _ws: any = undefined; // Platform-specific WebSocket instance

  constructor(
    protected readonly url: string,
    protected readonly options: WebSocketOptions = {}
  ) {
    super();
  }

  /**
   * Observable stream of connection state changes
   */
  get state$(): Observable<WebSocketState> {
    return this._state$.asObservable();
  }

  /**
   * Observable stream of connection-level errors
   */
  get error$(): Observable<Error> {
    return this._error$.asObservable();
  }

  /**
   * Observable stream of incoming messages (internal use)
   */
  get message$(): Observable<WebSocketMessage> {
    return this._message$.asObservable();
  }

  /**
   * Number of active virtual connections
   */
  get activeVirtualConnections(): number {
    return this._virtualConnections.size;
  }

  /**
   * Create a virtual connection. Underlying WebSocket is created lazily on first call.
   */
  async connect(): Promise<WebSocketConnection> {
    if (this.wasDisposed || this._state$.value === WebSocketState.Disposing) {
      throw new Error('Cannot create connections from disposed connector');
    }

    // Ensure underlying WebSocket exists
    if (!this._ws) {
      await this._ensureWebSocket();
    }

    // Create virtual connection
    const virtualConnection = new VirtualWebSocketConnection(
      this,
      () => {
        this._virtualConnections.delete(virtualConnection);
        // If no more virtual connections and not disposed, disconnect underlying WebSocket
        if (this._virtualConnections.size === 0 && !this.wasDisposed && this._state$.value !== WebSocketState.Disposing) {
          this._disconnectWebSocket();
        }
      }
    );

    this._virtualConnections.add(virtualConnection);
    return virtualConnection;
  }

  /**
   * Send data through the underlying WebSocket
   */
  send(data: WebSocketMessage): void {
    if (!this._ws || !this.isWebSocketOpen()) {
      throw new Error('WebSocket is not connected');
    }
    this.sendWebSocketMessage(data);
  }

  /**
   * Create platform-specific WebSocket instance
   */
  protected abstract createWebSocket(): any;

  /**
   * Check if the WebSocket is open/connected
   */
  protected abstract isWebSocketOpen(): boolean;

  /**
   * Send message through platform-specific WebSocket
   */
  protected abstract sendWebSocketMessage(data: WebSocketMessage): void;

  /**
   * Setup WebSocket event listeners
   */
  protected abstract setupWebSocketListeners(): void;

  /**
   * Close the platform-specific WebSocket
   */
  protected abstract closeWebSocket(): Promise<void>;

  /**
   * Update state from connector
   */
  protected updateState(state: WebSocketState): void {
    // Only update if we're not in disposal states
    if (this._state$.value !== WebSocketState.Disposing && this._state$.value !== WebSocketState.Disposed) {
      this._state$.next(state);
    }
  }

  /**
   * Emit error from connector
   */
  protected emitError(error: Error): void {
    this._error$.next(error);
  }

  /**
   * Emit message from connector
   */
  protected emitMessage(message: WebSocketMessage): void {
    this._message$.next(message);
  }

  /**
   * Ensure underlying WebSocket exists and is connected
   */
  private async _ensureWebSocket(): Promise<void> {
    if (this._ws) {
      return;
    }

    this._state$.next(WebSocketState.Connecting);
    
    try {
      this._ws = this.createWebSocket();
      this.setupWebSocketListeners();
      
      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = this.options.idleTimeout;
        let timeoutId: NodeJS.Timeout | undefined;

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
        };

        const onOpen = () => {
          cleanup();
          this._state$.next(WebSocketState.Connected);
          resolve();
        };

        const onError = (error: Error) => {
          cleanup();
          this._state$.next(WebSocketState.Disconnected);
          reject(error);
        };

        // Set up one-time listeners for connection establishment
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

    } catch (error) {
      this._state$.next(WebSocketState.Disconnected);
      delete this._ws;
      throw error;
    }
  }

  /**
   * Disconnect underlying WebSocket
   */
  private async _disconnectWebSocket(): Promise<void> {
    if (!this._ws) {
      return;
    }

    this._state$.next(WebSocketState.Disconnecting);
    
    try {
      await this.closeWebSocket();
    } finally {
      delete this._ws;
      if (this._state$.value !== WebSocketState.Disposing) {
        this._state$.next(WebSocketState.Disconnected);
      }
    }
  }

  /**
   * Dispose of all connections and resources
   */
  protected async _onDisposeAsync(): Promise<void> {
    this._state$.next(WebSocketState.Disposing);

    // Dispose all virtual connections
    const connections = Array.from(this._virtualConnections);
    for (const connection of connections) {
      connection.dispose();
    }
    this._virtualConnections.clear();

    // Disconnect underlying WebSocket
    if (this._ws) {
      await this._disconnectWebSocket();
    }

    this._state$.next(WebSocketState.Disposed);
    this._state$.complete();
    this._error$.complete();
    this._message$.complete();
  }

  // Simple event system for internal WebSocket events
  private _eventHandlers = new Map<string, Function[]>();

  protected emit(event: string, ...args: any[]): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  private once(event: string, handler: Function): void {
    const onceHandler = (...args: any[]) => {
      handler(...args);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  private on(event: string, handler: Function): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(handler);
  }

  private off(event: string, handler: Function): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}
