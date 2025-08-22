/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */

import { WebSocketMessage, WebSocketState, WebSocketOptions } from './interfaces';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';

/**
 * WebSocket connector for browser environments using the native WebSocket API.
 * 
 * @remarks
 * - Uses browser's built-in WebSocket class
 * - Supports binary data (ArrayBuffer, Uint8Array) and text messages
 * - Handles Blob data by converting to text
 * - Includes proper error handling and cleanup
 * - Supports WebSocket sub-protocols
 * 
 * @example
 * ```typescript
 * const connector = new BrowserWebSocketConnector('wss://api.example.com/ws', {
 *   protocols: ['v1', 'v2'],
 *   reconnectAttempts: 3,
 *   idleTimeoutMs: 30000
 * });
 * 
 * const connection = await connector.connect();
 * connection.subscribe(message => {
 *   console.log('Received:', message);
 * });
 * 
 * await connection.send('Hello WebSocket!');
 * ```
 */
export class BrowserWebSocketConnector extends WebSocketConnectorBase {
	private _webSocket: WebSocket | undefined;

	constructor(url: string, options?: WebSocketOptions) {
		super(url, options);
	}

	protected async _ensureConnection(): Promise<WebSocketState> {
		if (this._webSocket?.readyState === WebSocket.OPEN) {
			return WebSocketState.Connected;
		}

		if (this._webSocket?.readyState === WebSocket.CONNECTING) {
			return WebSocketState.Connecting;
		}

		return this._connectWebSocket();
	}

	protected async _sendMessage(data: WebSocketMessage): Promise<void> {
		if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}

		// Browser WebSocket.send() is synchronous but we return a Promise for consistency
		this._webSocket.send(data);
	}

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
				this._webSocket?.removeEventListener('close', onClose);
				resolve();
			};

			const onClose = () => cleanup();
      
			this._webSocket.addEventListener('close', onClose);
			this._webSocket.close(1000, 'Normal closure');

			// Force close after timeout
			setTimeout(() => {
				if (this._webSocket && this._webSocket.readyState !== WebSocket.CLOSED) {
					cleanup();
				}
			}, 5000);
		});
	}

	private async _connectWebSocket(): Promise<WebSocketState> {
		return new Promise<WebSocketState>((resolve, reject) => {
			// Create WebSocket with protocols if specified
			const ws = this.options?.protocols 
				? new WebSocket(this.url, this.options.protocols)
				: new WebSocket(this.url);
      
			this._webSocket = ws;

			const onOpen = () => {
				cleanup();
				this._updateState(WebSocketState.Connected);
				resolve(WebSocketState.Connected);
			};

			const onMessage = (event: MessageEvent) => {
				let message: WebSocketMessage;
        
				// Handle different data types from browser WebSocket
				if (event.data instanceof ArrayBuffer) {
					message = new Uint8Array(event.data);
				} else if (event.data instanceof Blob) {
					// For Blob data, we'd need to read it asynchronously
					// For now, convert to string (most common case)
					event.data.text().then(text => this._emitMessage(text));
					return;
				} else if (typeof event.data === 'string') {
					message = event.data;
				} else {
					// Fallback for other types
					message = String(event.data);
				}

				this._emitMessage(message);
			};

			const onClose = (event: CloseEvent) => {
				cleanup();
        
				// Only treat non-normal closures as potential reconnection triggers
				if (event.code !== 1000) {
					const error = new Error(`WebSocket closed with code ${event.code}: ${event.reason}`);
					this._handleConnectionFailure(error);
				} else {
					this._updateState(WebSocketState.Disconnected);
				}
			};

			const onError = () => {
				cleanup();
				const error = new Error('WebSocket connection error');
				this._handleConnectionFailure(error);
				reject(error);
			};

			const cleanup = () => {
				ws.removeEventListener('open', onOpen);
				ws.removeEventListener('message', onMessage);
				ws.removeEventListener('close', onClose);
				ws.removeEventListener('error', onError);
			};

			// Set up event listeners
			ws.addEventListener('open', onOpen);
			ws.addEventListener('message', onMessage);
			ws.addEventListener('close', onClose);
			ws.addEventListener('error', onError);

			// Set connecting state
			this._updateState(WebSocketState.Connecting);
		});
	}

	protected _onDisposeAsync(): Promise<void> {
		return this._ensureDisconnect();
	}
}
