/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */

import WebSocket from 'ws';
import { WebSocketMessage, WebSocketState, WebSocketOptions } from './interfaces';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';

/**
 * Node.js WebSocket connector implementation using the 'ws' library.
 * 
 * @remarks
 * This connector is specifically designed for server-side Node.js environments
 * and utilizes the popular 'ws' WebSocket library. It provides comprehensive
 * data type handling for Buffer, ArrayBuffer, string, and array formats,
 * with automatic reconnection and connection pooling capabilities.
 * 
 * The implementation handles Node.js-specific features like custom headers,
 * protocol selection, and proper resource cleanup with termination support.
 * 
 * @example
 * ```typescript
 * import { NodeWebSocketConnector } from '@tsdotnet/websocket-connector/node';
 * 
 * // Basic usage
 * const connector = new NodeWebSocketConnector('ws://localhost:8080');
 * const connection = await connector.connect();
 * 
 * // With custom options
 * const secureConnector = new NodeWebSocketConnector('wss://api.example.com', {
 *   headers: { 'Authorization': 'Bearer token' },
 *   protocols: ['protocol1', 'protocol2'],
 *   idleTimeoutMs: 30000,
 *   reconnectAttempts: 5
 * });
 * 
 * // Subscribe to messages
 * connection.subscribe(message => {
 *   if (typeof message === 'string') {
 *     console.log('Text message:', message);
 *   } else {
 *     console.log('Binary data length:', message.byteLength);
 *   }
 * });
 * 
 * // Send different data types
 * await connection.send('Hello Server');
 * await connection.send(new Uint8Array([1, 2, 3, 4]));
 * await connection.send(Buffer.from('node buffer'));
 * ```
 */
export class NodeWebSocketConnector extends WebSocketConnectorBase {
	private _webSocket: WebSocket | undefined;

	/**
	 * Creates a new Node.js WebSocket connector instance.
	 * 
	 * @param url - The WebSocket server URL (ws:// or wss://)
	 * @param options - Optional configuration for the connector
	 * 
	 * @remarks
	 * The constructor initializes the connector but does not establish a connection.
	 * Call `connect()` to establish the WebSocket connection. The connector supports
	 * both secure (wss://) and non-secure (ws://) WebSocket URLs.
	 * 
	 * @example
	 * ```typescript
	 * // Basic connector
	 * const connector = new NodeWebSocketConnector('ws://localhost:8080');
	 * 
	 * // Secure connector with options
	 * const secure = new NodeWebSocketConnector('wss://api.example.com', {
	 *   headers: { 'User-Agent': 'MyApp/1.0' },
	 *   protocols: ['chat', 'superchat'],
	 *   reconnectAttempts: 3
	 * });
	 * ```
	 */
	constructor(url: string, options?: WebSocketOptions) {
		super(url, options);
	}

	/**
	 * Ensures a WebSocket connection is established and returns the current state.
	 * 
	 * @returns Promise resolving to the current connection state
	 * 
	 * @remarks
	 * This method checks the current WebSocket state and initiates a new connection
	 * if needed. It handles the Node.js 'ws' library's ready states and provides
	 * appropriate state mapping for the connector framework.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
	protected async _ensureConnection(): Promise<WebSocketState> {
		if (this._webSocket?.readyState === WebSocket.OPEN) {
			return WebSocketState.Connected;
		}

		if (this._webSocket?.readyState === WebSocket.CONNECTING) {
			return WebSocketState.Connecting;
		}

		return this._connectWebSocket();
	}

	/**
	 * Sends a message through the WebSocket connection.
	 * 
	 * @param data - The message data to send (string or binary)
	 * @returns Promise that resolves when the message is sent
	 * @throws Error if the WebSocket is not open
	 * 
	 * @remarks
	 * This method uses the 'ws' library's send method with callback handling
	 * for proper async/await support. It supports all WebSocket message types
	 * including strings, ArrayBuffers, Uint8Arrays, and Node.js Buffers.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
	protected async _sendMessage(data: WebSocketMessage): Promise<void> {
		if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}

		return new Promise<void>((resolve, reject) => {
      this._webSocket!.send(data, (error) => {
      	if (error) {
      		reject(error);
      	} else {
      		resolve();
      	}
      });
		});
	}

	/**
	 * Ensures the WebSocket connection is properly disconnected and cleaned up.
	 * 
	 * @returns Promise that resolves when disconnection is complete
	 * 
	 * @remarks
	 * This method performs a graceful shutdown with proper cleanup of event listeners
	 * and resource disposal. It includes a timeout mechanism to force termination
	 * if graceful close takes too long, preventing resource leaks.
	 * 
	 * The method uses a 5-second timeout before forcing termination, which is
	 * appropriate for most use cases while preventing indefinite hanging.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
	protected async _ensureDisconnect(): Promise<void> {
		if (!this._webSocket || this._webSocket.readyState === WebSocket.CLOSED) {
			return;
		}

		return new Promise<void>((resolve) => {
			if (!this._webSocket) {
				resolve();
				return;
			}

			if (this._webSocket.readyState === WebSocket.CLOSED) {
				resolve();
				return;
			}

			const cleanup = () => {
				this._webSocket?.removeAllListeners();
				resolve();
			};

			this._webSocket.once('close', cleanup);
			this._webSocket.close(1000, 'Normal closure');

			// Force close after timeout
			setTimeout(() => {
				if (this._webSocket && this._webSocket.readyState !== WebSocket.CLOSED) {
					this._webSocket.terminate();
					cleanup();
				}
			}, 5000);
		});
	}

	/**
	 * Establishes a new WebSocket connection with full event handling.
	 * 
	 * @returns Promise resolving to the connection state after establishment
	 * 
	 * @remarks
	 * This method creates a new WebSocket instance using the 'ws' library,
	 * configures all necessary event handlers, and manages the connection lifecycle.
	 * 
	 * Key features:
	 * - Supports custom headers and protocols
	 * - Handles multiple data formats (Buffer, ArrayBuffer, string, array)
	 * - Implements proper error handling and reconnection triggers
	 * - Manages connection state transitions
	 * 
	 * The method includes comprehensive data type handling for the various
	 * formats that the 'ws' library may provide in message events.
	 * 
	 * @private This is a private implementation method.
	 */
	private async _connectWebSocket(): Promise<WebSocketState> {
		return new Promise<WebSocketState>((resolve, reject) => {
			// Create WebSocket with options
			const wsOptions: WebSocket.ClientOptions = {};

			if (this.options?.headers) {
				wsOptions.headers = this.options.headers;
			}

			const ws = this.options?.protocols 
				? new WebSocket(this.url, this.options.protocols, wsOptions)
				: new WebSocket(this.url, wsOptions);
      
			this._webSocket = ws;

			ws.on('open', () => {
				this._updateState(WebSocketState.Connected);
				resolve(WebSocketState.Connected);
			});

			ws.on('message', (data: WebSocket.RawData) => {
				let message: WebSocketMessage;
        
				// Handle different data types from ws library
				if (Buffer.isBuffer(data)) {
					message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
				} else if (data instanceof ArrayBuffer) {
					message = new Uint8Array(data);
				} else if (typeof data === 'string') {
					message = data;
				} else if (Array.isArray(data)) {
					// Handle array of Buffers by concatenating
					const totalLength = data.reduce((acc, buf) => acc + buf.length, 0);
					const combined = new Uint8Array(totalLength);
					let offset = 0;
					for (const buf of data) {
						combined.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), offset);
						offset += buf.length;
					}
					message = combined;
				} else {
					// Fallback for other types
					message = String(data);
				}

				this._emitMessage(message);
			});

			ws.on('close', (code: number, reason: Buffer) => {
				// Only treat non-normal closures as potential reconnection triggers
				if (code !== 1000) {
					const error = new Error(`WebSocket closed with code ${code}: ${reason.toString()}`);
					this._handleConnectionFailure(error);
				} else {
					this._updateState(WebSocketState.Disconnected);
				}
			});

			ws.on('error', (error: Error) => {
				this._handleConnectionFailure(error);
				reject(error);
			});

			// Set connecting state
			this._updateState(WebSocketState.Connecting);
		});
	}

	/**
	 * Handles resource cleanup during disposal.
	 * 
	 * @returns Promise that resolves when cleanup is complete
	 * 
	 * @remarks
	 * This method is called automatically during disposal and ensures that
	 * all WebSocket resources are properly cleaned up to prevent memory leaks.
	 * It delegates to the disconnect logic for consistent resource management.
	 * 
	 * @protected This method is part of the disposal pattern implementation.
	 */
	protected _onDisposeAsync(): Promise<void> {
		return this._ensureDisconnect();
	}
}
