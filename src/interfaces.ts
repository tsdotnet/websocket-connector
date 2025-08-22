import { Observable } from 'rxjs';
import { AsyncDisposable, Disposable } from '@tsdotnet/disposable';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  Disconnected = 'disconnected',
  Connecting = 'connecting', 
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Disconnecting = 'disconnecting',
  Disposing = 'disposing',
  Disposed = 'disposed'
}

/**
 * Configuration options for WebSocket connections
 */
export interface WebSocketOptions {
  protocols?: string | string[];
  headers?: Record<string, string>;
  idleTimeout?: number;
  reconnectOnFailure?: boolean;
}

/**
 * Message types that can be sent through WebSocket
 */
export type WebSocketMessage = string | ArrayBuffer | Uint8Array;

/**
 * Factory/Manager for WebSocket connections with connection pooling and lazy initialization
 */
export interface WebSocketConnector extends AsyncDisposable {
  /**
   * Get a virtual connection. Creates underlying connection on first call (lazy).
   * Multiple virtual connections share the same underlying connection.
   */
  connect(): Promise<WebSocketConnection>;

  /**
   * Observable stream of connection state changes
   */
  readonly state$: Observable<WebSocketState>;

  /**
   * Observable stream of connection-level errors
   */
  readonly error$: Observable<Error>;

  /**
   * Number of active virtual connections
   */
  readonly activeVirtualConnections: number;
}

/**
 * Virtual connection interface for messaging
 */
export interface WebSocketConnection extends Disposable {
  /**
   * Observable stream of incoming messages
   */
  readonly message$: Observable<WebSocketMessage>;

  /**
   * Send a message through the connection
   */
  send(data: WebSocketMessage): Promise<void>;
}
