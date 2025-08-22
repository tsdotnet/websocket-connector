import { Observable, Subscription, PartialObserver } from 'rxjs';
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
  /** WebSocket sub-protocols */
  protocols?: string | string[];
  
  /** Custom headers (Node.js only) */
  headers?: Record<string, string>;
  
  /** Idle timeout in milliseconds before disconnecting when no virtual connections are active (default: 10000ms) */
  idleTimeoutMs?: number;
  
  /** Auto-reconnect on connection failure (default: false) */
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

  /**
   * Shortcut for message$.subscribe() - convenience method for the most common use case
   */
  subscribe(observer?: PartialObserver<WebSocketMessage> | ((value: WebSocketMessage) => void)): Subscription;
}
