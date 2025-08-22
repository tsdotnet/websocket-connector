import { AsyncDisposableBase, DisposableBase } from '@tsdotnet/disposable';
import { BehaviorSubject, Observable, PartialObserver, Subject, type Subscription } from 'rxjs';
import { WebSocketConnector, WebSocketConnection, WebSocketMessage, WebSocketOptions, WebSocketState } from './interfaces';

/**
 * Virtual WebSocket connection that wraps the connector's underlying WebSocket
 * Multiple virtual connections can share the same underlying WebSocket
 */
class VirtualWebSocketConnection extends DisposableBase implements WebSocketConnection {
  private readonly _message$ = new Subject<WebSocketMessage>();
  private readonly _subscription: Subscription;

  readonly message$: Observable<WebSocketMessage>;

  constructor(
    private readonly _connector: WebSocketConnectorBase,
    private readonly _sendFn: (data: WebSocketMessage) => Promise<void>,
    private readonly _onDisposeCallback: () => void
  ) {
    super();

    this.message$ = this._message$.asObservable();

    // Forward messages from connector to this virtual connection
    this._subscription = this._connector.message$.subscribe({
      next: (message) => this._message$.next(message),
      complete: () => this._message$.complete()
    });
  }

  async send(data: WebSocketMessage): Promise<void> {
    this.assertIsAlive();
    await this._sendFn(data);
  }

	subscribe(observer?: PartialObserver<WebSocketMessage> | ((value: WebSocketMessage) => void)): Subscription {
		return this.message$.subscribe(observer);
	}

  protected _onDispose(): void {
    this._subscription.unsubscribe();
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
  private _idleTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /**
   * Observable stream of connection state changes
   */
  readonly state$: Observable<WebSocketState>;

  /**
   * Observable stream of connection-level errors
   */
  readonly error$: Observable<Error>;

  /**
   * Observable stream of incoming messages (internal use)
   */
  readonly message$: Observable<WebSocketMessage>;

  /**
   * Update state from connector
   */
  protected _updateState(state: WebSocketState): void {
    // Only update if we're not in disposal states
    if (this._state$.value !== WebSocketState.Disposing && this._state$.value !== WebSocketState.Disposed) {
      this._state$.next(state);
    }
  }

  /**
   * Emit error from connector
   */
  protected _emitError(error: Error): void {
    this._error$.next(error);
  }

  /**
   * Emit message from connector
   */
  protected _emitMessage(message: WebSocketMessage): void {
    this._message$.next(message);
  }

  constructor(
    protected readonly url: string,
    protected readonly options: WebSocketOptions = {}
  ) {
    super();

    // Create readonly observables once in constructor
    this.state$ = this._state$.asObservable();
    this.error$ = this._error$.asObservable();
    this.message$ = this._message$.asObservable();
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
    this.assertIsAlive();

    // Cancel any pending idle disconnect since we're creating a new connection
    this._cancelIdleDisconnect();

    // Ensure underlying WebSocket exists
    if (this._state$.value !== WebSocketState.Connected) {
      await this._connect();
    }

    // Create virtual connection
    const virtualConnection = new VirtualWebSocketConnection(
      this,
      (data: WebSocketMessage) => this._send(data),
      () => {
        this._virtualConnections.delete(virtualConnection);
        // If no more virtual connections, start idle timeout
        if (this._virtualConnections.size === 0) {
          this._scheduleIdleDisconnect();
        }
      }
    );

    this._virtualConnections.add(virtualConnection);
    return virtualConnection;
  }

  /**
   * Send data through the underlying WebSocket (private - used by virtual connections)
   */
  private async _send(data: WebSocketMessage): Promise<void> {
    this.assertIsAlive();

    // Ensure we're connected, wait for connection if needed
    if (this._state$.value !== WebSocketState.Connected) {
      await this._connect();
    }

    // Double-check after potential connection attempt
    if (this._state$.value !== WebSocketState.Connected) {
      throw new Error('WebSocket failed to connect.');
    }

    await this._sendMessage(data);
  }

  /**
   * Schedule idle disconnect after a short timeout
   */
  private _scheduleIdleDisconnect(): void {
    // Only schedule if we're in a state where we want to be connected
    if (!this.targetState) {
      return;
    }

    // Cancel any existing timeout
    this._cancelIdleDisconnect();

		// Use a default timeout of 10 seconds if not specified
		const idleTimeout = this.options.idleTimeoutMs ?? 10000;

    this._idleTimeoutId = setTimeout(() => {
      this._idleTimeoutId = undefined;
      // Double-check we still have no virtual connections before disconnecting
      if (this._virtualConnections.size === 0 && !this.wasDisposed && this._state$.value !== WebSocketState.Disposing) {
        this._disconnect();
      }
    }, idleTimeout);
  }

  /**
   * Cancel any pending idle disconnect
   */
  private _cancelIdleDisconnect(): void {
    const t = this._idleTimeoutId;
    if (t !== undefined) {
      this._idleTimeoutId = undefined;
      clearTimeout(t);
    }
  }

  protected abstract _ensureConnection(): Promise<WebSocketState>

  protected abstract _sendMessage(data: WebSocketMessage): Promise<void>;

  protected abstract _ensureDisconnect(): Promise<void>;

  /**
   * Ensure underlying WebSocket exists and is connected
   */
  private async _connect(): Promise<void> {
    if (this._state$.value === WebSocketState.Connected) {
      return;
    }

    const d = this._disconnecting;
    if (d) await d;

    this.assertIsAlive();

    this._state$.next(WebSocketState.Connecting);

    try {
      this._state$.next(await this._ensureConnection());
    } catch (error) {
      this._state$.next(WebSocketState.Disconnected);
      throw error;
    }
  }

  protected get targetState(): boolean {
    switch (this._state$.value) {
      case WebSocketState.Connecting:
      case WebSocketState.Reconnecting:
      case WebSocketState.Connected:
        return true;
      default:
        return false;
    }
  }

  private _disconnecting?: Promise<void> | null | undefined;

  /**
   * Disconnect underlying WebSocket
   */
  private async _disconnect(): Promise<void> {
    const d = this._disconnecting;
    if (d) return d;

    this._state$.next(WebSocketState.Disconnecting);

    // If this fails, we're in serious trouble.
    // closeWebSocket needs to be robust.
    await (this._disconnecting = this._ensureDisconnect());
    this._disconnecting = null;

    this._state$.next(WebSocketState.Disconnected);
  }

  /**
   * Dispose of all connections and resources
   */
  protected async _onDisposeAsync(): Promise<void> {
    // Complete message and error observables immediately to prevent further emissions
    this._message$.complete();
    this._error$.complete();

    // First fire a disconnect so that any listeners can handle that disconnection sequence
    await this._disconnect();

    // After disconnection, proceed with disposal
    this._state$.next(WebSocketState.Disposing);

    // Dispose all virtual connections
    const connections = Array.from(this._virtualConnections);
    for (const connection of connections) {
      // Disposing of a connection removes it from the set
      connection.dispose();
    }

    this._state$.next(WebSocketState.Disposed);
    
    // Complete state observable AFTER emitting final state
    this._state$.complete();
  }

}
