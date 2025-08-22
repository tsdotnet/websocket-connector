/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */

import WebSocket from 'ws';
import { WebSocketMessage, WebSocketState, WebSocketOptions } from './interfaces';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';

/**
 * Node.js WebSocket connector implementation
 * Uses the 'ws' library for WebSocket connections
 */
export class NodeWebSocketConnector extends WebSocketConnectorBase {
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

	protected _onDisposeAsync(): Promise<void> {
		return this._ensureDisconnect();
	}
}
