import { WebSocketConnectorBase } from './WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from './interfaces';

/**
 * Mock WebSocket implementation for testing purposes.
 * Provides simulation methods for various WebSocket events and states.
 */
export class MockWebSocket {
	onopen?: () => void;
	onmessage?: (event: { data: WebSocketMessage }) => void;
	onclose?: () => void;
	onerror?: (error: Error) => void;
	readyState: number = 0; // CONNECTING initially

	/**
   * Sends data through the mock WebSocket.
   * @param data The data to send
   * @throws Error if WebSocket is not in open state
   */
	send(data: WebSocketMessage): void {
		if (this.readyState !== 1) {
			throw new Error('WebSocket is not open');
		}
		// Echo the message back for testing
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage({ data });
			}
		}, 1);
	}

	/**
   * Closes the mock WebSocket connection.
   */
	close(): void {
		this.readyState = 2; // CLOSING
		setTimeout(() => {
			this.readyState = 3; // CLOSED
			if (this.onclose) this.onclose();
		}, 1);
	}

	/**
   * Simulates the WebSocket opening successfully.
   */
	simulateOpen(): void {
		this.readyState = 1; // OPEN
		setTimeout(() => {
			if (this.onopen) this.onopen();
		}, 1);
	}

	/**
   * Simulates receiving a message from the WebSocket.
   * @param message The message to simulate receiving
   */
	simulateMessage(message: WebSocketMessage): void {
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage({ data: message });
			}
		}, 1);
	}

	/**
   * Simulates a WebSocket error.
   * @param error The error to simulate
   */
	simulateError(error: Error): void {
		setTimeout(() => {
			if (this.onerror) this.onerror(error);
			// Errors typically close the connection
			this.readyState = 3; // CLOSED
			if (this.onclose) this.onclose();
		}, 1);
	}

	/**
   * Simulates the WebSocket closing.
   */
	simulateClose(): void {
		this.readyState = 3; // CLOSED
		setTimeout(() => {
			if (this.onclose) this.onclose();
		}, 1);
	}

	/**
   * Simulates a connection failure (error followed by close).
   */
	simulateConnectionFailure(): void {
		this.simulateError(new Error('Network failure'));
	}
}

/**
 * Mock WebSocket connector implementation for testing purposes.
 * Extends WebSocketConnectorBase to provide a controllable WebSocket implementation
 * that can be used in unit tests to simulate various connection scenarios.
 */
export class MockWebSocketConnector extends WebSocketConnectorBase {
	public mockWs?: MockWebSocket;

	protected async _ensureConnection(): Promise<WebSocketState> {
		if (this.mockWs?.readyState === 1) {
			return WebSocketState.Connected;
		}

		// If we already have a connecting WebSocket, wait for it
		if (this.mockWs?.readyState === 0) {
			return new Promise<WebSocketState>((resolve) => {
				const checkConnection = () => {
					if (this.mockWs?.readyState === 1) {
						resolve(WebSocketState.Connected);
					} else {
						setTimeout(checkConnection, 1);
					}
				};
				checkConnection();
			});
		}

		return this._connectWebSocket();
	}

	protected async _sendMessage(data: WebSocketMessage): Promise<void> {
		if (!this.mockWs || this.mockWs.readyState !== 1) {
			throw new Error('WebSocket not connected');
		}
		this.mockWs.send(data);
	}

	protected async _ensureDisconnect(): Promise<void> {
		if (this.mockWs && this.mockWs.readyState !== 3) {
			this.mockWs.close();
			// Wait for close event
			return new Promise<void>(resolve => {
				const checkClosed = () => {
					if (!this.mockWs || this.mockWs.readyState === 3) {
						resolve();
					} else {
						setTimeout(checkClosed, 1);
					}
				};
				checkClosed();
			});
		}
	}

	private async _connectWebSocket(): Promise<WebSocketState> {
		return new Promise<WebSocketState>((resolve) => {
			this.mockWs = new MockWebSocket();
			this._setupWebSocketListeners();
      
			// Auto-open the connection after a short delay
			setTimeout(() => {
				if (this.mockWs) {
					this.mockWs.simulateOpen();
					resolve(WebSocketState.Connected);
				}
			}, 5);
		});
	}

	private _setupWebSocketListeners(): void {
		if (!this.mockWs) return;

		this.mockWs.onopen = () => {
			// Don't emit Connected here - let the _ensureConnection promise handle it
		};

		this.mockWs.onmessage = (event) => {
			this._emitMessage(event.data);
		};

		this.mockWs.onclose = () => {
			this._updateState(WebSocketState.Disconnected);
		};

		this.mockWs.onerror = (error) => {
			this._emitError(error);
		};
	}

	/**
   * Simulates the underlying connection opening successfully.
   */
	simulateConnection(): void {
		if (this.mockWs) {
			this.mockWs.simulateOpen();
		}
	}

	/**
   * Simulates receiving a message from the WebSocket.
   * @param message The message to simulate receiving
   */
	simulateMessage(message: WebSocketMessage): void {
		if (this.mockWs) {
			this.mockWs.simulateMessage(message);
		}
	}

	/**
   * Simulates a WebSocket error.
   * @param error The error to simulate
   */
	simulateError(error: Error): void {
		if (this.mockWs) {
			this.mockWs.simulateError(error);
		}
	}

	/**
   * Simulates the WebSocket disconnecting.
   */
	simulateDisconnection(): void {
		if (this.mockWs) {
			this.mockWs.simulateClose();
		}
	}

	/**
   * Simulates a connection failure.
   */
	simulateConnectionFailure(): void {
		if (this.mockWs) {
			this.mockWs.simulateError(new Error('Network failure'));
		}
	}

	/**
   * Provides access to the underlying mock WebSocket for advanced testing scenarios.
   */
	get mockConnection(): MockWebSocket | undefined {
		return this.mockWs;
	}
}
