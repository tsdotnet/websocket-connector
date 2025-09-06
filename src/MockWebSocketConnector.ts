import { WebSocketConnectorBase } from './WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from './interfaces';

/**
 * Mock WebSocket implementation for testing and development purposes.
 * 
 * @remarks
 * This class provides a controllable WebSocket-like interface that can be used
 * to simulate various connection states, events, and error conditions without
 * requiring an actual WebSocket server. It's designed for unit testing,
 * development, and integration testing scenarios.
 * 
 * The mock maintains proper state transitions and timing similar to real
 * WebSocket implementations, making it suitable for testing connection logic,
 * error handling, and message flow.
 * 
 * @example
 * ```typescript
 * // Basic usage in tests
 * const mockWs = new MockWebSocket();
 * mockWs.onopen = () => console.log('Connected');
 * mockWs.onmessage = (event) => console.log('Received:', event.data);
 * 
 * // Simulate connection
 * mockWs.simulateOpen();
 * 
 * // Simulate receiving messages
 * mockWs.simulateMessage('Hello from server');
 * mockWs.simulateMessage(new Uint8Array([1, 2, 3]));
 * 
 * // Test error scenarios
 * mockWs.simulateError(new Error('Connection lost'));
 * ```
 */
export class MockWebSocket {
	onopen?: () => void;
	onmessage?: (event: { data: WebSocketMessage }) => void;
	onclose?: () => void;
	onerror?: (error: Error) => void;
	/**
	 * The current ready state of the mock WebSocket connection.
	 * 
	 * @remarks
	 * Follows the standard WebSocket readyState values:
	 * - 0 (CONNECTING): The connection has not yet been established
	 * - 1 (OPEN): The connection is established and communication is possible  
	 * - 2 (CLOSING): The connection is going through the closing handshake
	 * - 3 (CLOSED): The connection has been closed or could not be opened
	 * 
	 * @defaultValue 0 (CONNECTING)
	 */
	readyState: number = 0; // CONNECTING initially

	/**
	 * Sends data through the mock WebSocket with automatic echo functionality.
	 * 
	 * @param data - The message data to send (string or binary)
	 * @throws Error if WebSocket is not in open state (readyState !== 1)
	 * 
	 * @remarks
	 * This method simulates sending data through a WebSocket connection.
	 * For testing purposes, it automatically echoes the sent message back
	 * through the onmessage handler after a minimal delay.
	 * 
	 * @example
	 * ```typescript
	 * mockWs.onmessage = (event) => console.log('Echo:', event.data);
	 * mockWs.send('Hello'); // Will echo back 'Hello'
	 * ```
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
	 * Closes the mock WebSocket connection gracefully.
	 * 
	 * @remarks
	 * This method simulates the WebSocket closing handshake by transitioning
	 * through the CLOSING state before reaching CLOSED. The onclose handler
	 * is triggered after the state transition completes.
	 * 
	 * @example
	 * ```typescript
	 * mockWs.onclose = () => console.log('Connection closed');
	 * mockWs.close(); // Will trigger onclose after state transition
	 * ```
	 */
	close(): void {
		this.readyState = 2; // CLOSING
		setTimeout(() => {
			this.readyState = 3; // CLOSED
			if (this.onclose) this.onclose();
		}, 1);
	}

	/**
	 * Simulates the WebSocket connection opening successfully.
	 * 
	 * @remarks
	 * This method transitions the mock WebSocket to the OPEN state (readyState = 1)
	 * and triggers the onopen event handler. This is used to simulate a successful
	 * connection establishment in testing scenarios.
	 * 
	 * @example
	 * ```typescript
	 * mockWs.onopen = () => console.log('Connection established');
	 * mockWs.simulateOpen(); // Will trigger onopen event
	 * ```
	 */
	simulateOpen(): void {
		this.readyState = 1; // OPEN
		setTimeout(() => {
			if (this.onopen) this.onopen();
		}, 1);
	}

	/**
	 * Simulates receiving a message from the WebSocket server.
	 * 
	 * @param message - The message data to simulate receiving
	 * 
	 * @remarks
	 * This method triggers the onmessage event handler with the provided message,
	 * simulating data reception from a WebSocket server. Supports both string
	 * and binary message formats.
	 * 
	 * @example
	 * ```typescript
	 * mockWs.onmessage = (event) => console.log('Received:', event.data);
	 * mockWs.simulateMessage('Server message');
	 * mockWs.simulateMessage(new Uint8Array([72, 101, 108, 108, 111]));
	 * ```
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
 * Mock WebSocket connector implementation for comprehensive testing and development.
 * 
 * @remarks
 * This connector extends WebSocketConnectorBase to provide a fully controllable
 * WebSocket implementation that can be used in unit tests, integration tests,
 * and development environments. It simulates real WebSocket behavior including
 * connection states, timing, error conditions, and message flow.
 * 
 * The mock connector is particularly useful for:
 * - Testing connection logic without requiring a WebSocket server
 * - Simulating network failures and error conditions
 * - Validating message handling and state transitions
 * - Development environments where server setup is impractical
 * 
 * All simulation methods operate with realistic timing delays to better
 * replicate actual WebSocket behavior in testing scenarios.
 * 
 * @example
 * ```typescript
 * import { MockWebSocketConnector } from '@tsdotnet/websocket-connector/mock';
 * 
 * // Basic testing setup
 * const connector = new MockWebSocketConnector('mock://test-server');
 * const connection = await connector.connect();
 * 
 * // Test message handling
 * const messages: string[] = [];
 * connection.subscribe(msg => messages.push(msg as string));
 * 
 * // Simulate server messages
 * connector.simulateMessage('Hello from mock server');
 * connector.simulateMessage(new Uint8Array([1, 2, 3, 4]));
 * 
 * // Test error scenarios
 * connector.simulateError(new Error('Network timeout'));
 * 
 * // Test connection failures
 * connector.simulateConnectionFailure();
 * 
 * // Access underlying mock for advanced testing
 * const mockWs = connector.mockConnection;
 * mockWs?.simulateOpen();
 * ```
 */
export class MockWebSocketConnector extends WebSocketConnectorBase {
	/**
	 * The underlying MockWebSocket instance used for simulation.
	 * 
	 * @remarks
	 * This property provides access to the mock WebSocket instance for
	 * advanced testing scenarios where direct control over the mock
	 * behavior is needed. It's undefined until a connection is established.
	 */
	public mockWs?: MockWebSocket;

	/**
	 * Ensures a mock WebSocket connection is established and returns the current state.
	 * 
	 * @returns Promise resolving to the current connection state
	 * 
	 * @remarks
	 * This method manages the mock WebSocket connection lifecycle, automatically
	 * establishing connections and handling state transitions. For testing purposes,
	 * connections are established quickly with minimal delays.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
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

	/**
	 * Sends a message through the mock WebSocket connection.
	 * 
	 * @param data - The message data to send (string or binary)
	 * @returns Promise that resolves when the message is sent
	 * @throws Error if the mock WebSocket is not connected
	 * 
	 * @remarks
	 * This method delegates to the underlying MockWebSocket send method,
	 * which includes automatic echo functionality for testing purposes.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
	protected async _sendMessage(data: WebSocketMessage): Promise<void> {
		if (!this.mockWs || this.mockWs.readyState !== 1) {
			throw new Error('WebSocket not connected');
		}
		this.mockWs.send(data);
	}

	/**
	 * Ensures the mock WebSocket connection is properly disconnected.
	 * 
	 * @returns Promise that resolves when disconnection is complete
	 * 
	 * @remarks
	 * This method gracefully closes the mock WebSocket connection and waits
	 * for the close event to complete. The timing is kept minimal for testing
	 * efficiency while maintaining realistic behavior patterns.
	 * 
	 * @internal This is an internal method used by the base connector class.
	 */
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
	 * Simulates the underlying WebSocket connection opening successfully.
	 * 
	 * @remarks
	 * This method triggers the connection establishment process on the underlying
	 * MockWebSocket. Use this in tests to simulate successful connection scenarios.
	 * 
	 * @example
	 * ```typescript
	 * const connector = new MockWebSocketConnector('mock://test');
	 * await connector.connect();
	 * connector.simulateConnection(); // Simulates successful connection
	 * ```
	 */
	simulateConnection(): void {
		if (this.mockWs) {
			this.mockWs.simulateOpen();
		}
	}

	/**
	 * Simulates receiving a message from the WebSocket server.
	 * 
	 * @param message - The message data to simulate receiving
	 * 
	 * @remarks
	 * This method simulates incoming messages from a WebSocket server, allowing
	 * tests to verify message handling logic. Supports both string and binary
	 * message formats for comprehensive testing.
	 * 
	 * @example
	 * ```typescript
	 * connection.subscribe(msg => console.log('Received:', msg));
	 * connector.simulateMessage('Hello from server');
	 * connector.simulateMessage(new Uint8Array([72, 101, 108, 108, 111]));
	 * ```
	 */
	simulateMessage(message: WebSocketMessage): void {
		if (this.mockWs) {
			this.mockWs.simulateMessage(message);
		}
	}

	/**
	 * Simulates a WebSocket error condition.
	 * 
	 * @param error - The error to simulate
	 * 
	 * @remarks
	 * This method simulates various error conditions that can occur during
	 * WebSocket communication. The error will be propagated through the
	 * connector's error handling mechanisms for testing error recovery logic.
	 * 
	 * @example
	 * ```typescript
	 * connection.error$.subscribe(err => console.log('Error:', err.message));
	 * connector.simulateError(new Error('Network timeout'));
	 * connector.simulateError(new Error('Authentication failed'));
	 * ```
	 */
	simulateError(error: Error): void {
		if (this.mockWs) {
			this.mockWs.simulateError(error);
		}
	}

	/**
	 * Simulates the WebSocket connection closing gracefully.
	 * 
	 * @remarks
	 * This method simulates a normal WebSocket disconnection, triggering
	 * the appropriate state transitions and cleanup. Use this to test
	 * graceful disconnection scenarios.
	 * 
	 * @example
	 * ```typescript
	 * connection.state$.subscribe(state => console.log('State:', state));
	 * connector.simulateDisconnection(); // Will show Disconnected state
	 * ```
	 */
	simulateDisconnection(): void {
		if (this.mockWs) {
			this.mockWs.simulateClose();
		}
	}

	/**
	 * Simulates a connection failure scenario.
	 * 
	 * @remarks
	 * This method simulates a network-level connection failure, which triggers
	 * both error handling and connection recovery mechanisms. This is useful
	 * for testing reconnection logic and error resilience.
	 * 
	 * @example
	 * ```typescript
	 * connector.simulateConnectionFailure();
	 * // Will trigger reconnection attempts based on connector configuration
	 * ```
	 */
	simulateConnectionFailure(): void {
		if (this.mockWs) {
			this.mockWs.simulateError(new Error('Network failure'));
		}
	}

	/**
	 * Provides access to the underlying mock WebSocket for advanced testing scenarios.
	 * 
	 * @returns The underlying MockWebSocket instance, or undefined if not connected
	 * 
	 * @remarks
	 * This getter provides direct access to the MockWebSocket instance for
	 * advanced testing scenarios where fine-grained control over the mock
	 * behavior is required. The instance is only available after connection
	 * establishment begins.
	 * 
	 * @example
	 * ```typescript
	 * const connector = new MockWebSocketConnector('mock://test');
	 * await connector.connect();
	 * 
	 * const mockWs = connector.mockConnection;
	 * if (mockWs) {
	 *   // Direct mock control
	 *   mockWs.readyState = 2; // Force CLOSING state
	 *   mockWs.simulateOpen();
	 * }
	 * ```
	 */
	get mockConnection(): MockWebSocket | undefined {
		return this.mockWs;
	}
}
