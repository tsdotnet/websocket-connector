import { Observable, Subscription, PartialObserver } from 'rxjs';
import { AsyncDisposable, Disposable } from '@tsdotnet/disposable';

/**
 * WebSocket connection lifecycle states.
 * 
 * @remarks
 * States flow: Disconnected → Connecting → Connected → (Reconnecting ↔ Connected) → Disconnecting → Disposed
 */
export enum WebSocketState {
	/** Initial state, no connection established */
	Disconnected = 'disconnected',
	/** Attempting to establish connection */
	Connecting = 'connecting', 
	/** Connection established and ready */
	Connected = 'connected',
	/** Connection lost, attempting to reconnect */
	Reconnecting = 'reconnecting',
	/** Connection is being closed */
	Disconnecting = 'disconnecting',
	/** Connector is being disposed */
	Disposing = 'disposing',
	/** Connector has been disposed and cannot be reused */
	Disposed = 'disposed'
}

/**
 * Configuration options for WebSocket connections.
 * 
 * @remarks
 * All options are optional. Defaults provide sensible behavior for most use cases.
 */
export interface WebSocketOptions {
	/** 
	 * WebSocket sub-protocols to negotiate during connection.
	 * @example ['graphql-ws', 'graphql-transport-ws']
	 */
	protocols?: string | string[];
  
	/** 
	 * Custom HTTP headers to send with connection request.
	 * @remarks Only supported in Node.js environment
	 * @example { 'Authorization': 'Bearer token123' }
	 */
	headers?: Record<string, string>;
  
	/** 
	 * Idle timeout in milliseconds before auto-disconnect when no virtual connections exist.
	 * @defaultValue 10000 (10 seconds)
	 */
	idleTimeoutMs?: number;
  
	/** 
	 * Number of automatic reconnection attempts on connection failure.
	 * Uses exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s).
	 * @defaultValue 0 (no reconnection)
	 * @remarks Capped at maximum of 10 attempts to prevent abuse
	 */
	reconnectAttempts?: number;
}

/**
 * Supported message types for WebSocket communication.
 * 
 * @remarks
 * - `string`: Text messages (most common)
 * - `ArrayBuffer`: Binary data with fixed size
 * - `Uint8Array`: Binary data as byte array
 */
export type WebSocketMessage = string | ArrayBuffer | Uint8Array;

/**
 * WebSocket connector factory with connection pooling and virtual connection management.
 * 
 * @remarks
 * - Manages a single underlying WebSocket connection shared by multiple virtual connections
 * - Lazy initialization: physical connection created only when first virtual connection requested
 * - Automatic cleanup: disconnects when no virtual connections remain active
 * - Optional reconnection: configurable retry behavior with exponential backoff
 * 
 * @example
 * ```typescript
 * const connector = new BrowserWebSocketConnector('wss://api.example.com/ws');
 * const connection = await connector.connect();
 * connection.subscribe(message => console.log('Received:', message));
 * ```
 */
export interface WebSocketConnector extends AsyncDisposable {
	/**
	 * Create a virtual connection that shares the underlying WebSocket.
	 * 
	 * @remarks
	 * - First call establishes the physical WebSocket connection (lazy initialization)
	 * - Subsequent calls reuse the existing connection
	 * - Each virtual connection receives all messages but can be disposed independently
	 * 
	 * @returns Promise resolving to a virtual connection instance
	 * @throws Error if connector has been disposed
	 */
	connect(): Promise<WebSocketConnection>;

	/**
	 * Observable stream of connection state changes.
	 * 
	 * @remarks
	 * Emits current state immediately on subscription, then updates on state changes.
	 * Useful for UI state management and connection monitoring.
	 */
	readonly state$: Observable<WebSocketState>;

	/**
	 * Observable stream of connection-level errors.
	 * 
	 * @remarks
	 * Includes network errors, authentication failures, and reconnection errors.
	 * Does not include message parsing errors (handle those per virtual connection).
	 */
	readonly error$: Observable<Error>;

	/**
	 * Current number of active virtual connections.
	 * 
	 * @remarks
	 * - Increments when `connect()` is called
	 * - Decrements when virtual connection is disposed
	 * - Physical connection closes when this reaches 0 (after idle timeout)
	 */
	readonly activeVirtualConnections: number;
}

/**
 * Virtual WebSocket connection for independent message handling.
 * 
 * @remarks
 * - Wraps a shared physical WebSocket connection
 * - Provides isolated message streams for different application components
 * - Automatically disposes when parent connector is disposed
 * - Survives reconnection attempts (messages resume after reconnect)
 * 
 * @example
 * ```typescript
 * const connection = await connector.connect();
 * 
 * // Simple message handling
 * connection.subscribe(message => console.log(message));
 * 
 * // Advanced message handling with error handling
 * connection.message$.subscribe({
 *   next: message => processMessage(message),
 *   error: err => handleError(err),
 *   complete: () => console.log('Connection closed')
 * });
 * 
 * await connection.send('Hello WebSocket!');
 * ```
 */
export interface WebSocketConnection extends Disposable {
	/**
	 * Observable stream of incoming messages from the WebSocket.
	 * 
	 * @remarks
	 * - Emits all messages received on the shared connection
	 * - Completes when virtual connection is disposed
	 * - For simple cases, use the `subscribe()` shortcut method instead
	 */
	readonly message$: Observable<WebSocketMessage>;

	/**
	 * Send a message through the WebSocket connection.
	 * 
	 * @param data - Message to send (string, ArrayBuffer, or Uint8Array)
	 * @returns Promise that resolves when message is sent
	 * @throws Error if connection is not open or virtual connection is disposed
	 * 
	 * @example
	 * ```typescript
	 * await connection.send('Hello World');
	 * await connection.send(JSON.stringify({ type: 'ping' }));
	 * await connection.send(new Uint8Array([1, 2, 3, 4]));
	 * ```
	 */
	send(data: WebSocketMessage): Promise<void>;

	/**
	 * Convenience method for subscribing to messages - shortcut for `message$.subscribe()`.
	 * 
	 * @param observer - Observer function or object for handling messages
	 * @returns Subscription that can be unsubscribed
	 * 
	 * @remarks
	 * This is the most common usage pattern. Use `message$` directly for advanced RxJS operations.
	 * 
	 * @example
	 * ```typescript
	 * // Simple function
	 * const sub = connection.subscribe(msg => console.log(msg));
	 * 
	 * // Observer object with error handling
	 * const sub = connection.subscribe({
	 *   next: msg => console.log(msg),
	 *   error: err => console.error(err),
	 *   complete: () => console.log('Done')
	 * });
	 * 
	 * sub.unsubscribe(); // Stop receiving messages
	 * ```
	 */
	subscribe(observer?: PartialObserver<WebSocketMessage> | ((value: WebSocketMessage) => void)): Subscription;
}
