import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, take } from 'rxjs';
import { MockWebSocket, MockWebSocketConnector } from '../src/MockWebSocketConnector';
import { WebSocketState } from '../src/interfaces';

describe('MockWebSocket', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
  });

  describe('send()', () => {
    it('should throw error when not connected', () => {
      expect(() => mockWs.send('test')).toThrow('WebSocket is not open');
    });

    it('should echo message back when connected', async () => {
      let receivedMessage: any;
      mockWs.onmessage = (event) => {
        receivedMessage = event.data;
      };
      
      mockWs.simulateOpen();
      mockWs.send('test message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedMessage).toBe('test message');
    });
  });

  describe('close()', () => {
    it('should transition through closing states', async () => {
      let closeCalled = false;
      mockWs.onclose = () => {
        closeCalled = true;
      };

      expect(mockWs.readyState).toBe(0); // CONNECTING
      mockWs.close();
      expect(mockWs.readyState).toBe(2); // CLOSING
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWs.readyState).toBe(3); // CLOSED
      expect(closeCalled).toBe(true);
    });
  });

  describe('simulation methods', () => {
    it('should simulate open event', async () => {
      let openCalled = false;
      mockWs.onopen = () => {
        openCalled = true;
      };

      mockWs.simulateOpen();
      expect(mockWs.readyState).toBe(1); // OPEN
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(openCalled).toBe(true);
    });

    it('should simulate message event', async () => {
      let receivedMessage: any;
      mockWs.onmessage = (event) => {
        receivedMessage = event.data;
      };

      mockWs.simulateMessage('simulated message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedMessage).toBe('simulated message');
    });

    it('should simulate error and close connection', async () => {
      let errorReceived: Error | undefined;
      let closeCalled = false;
      
      mockWs.onerror = (error) => {
        errorReceived = error;
      };
      mockWs.onclose = () => {
        closeCalled = true;
      };

      const testError = new Error('Test error');
      mockWs.simulateError(testError);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(errorReceived).toBe(testError);
      expect(mockWs.readyState).toBe(3); // CLOSED
      expect(closeCalled).toBe(true);
    });

    it('should simulate close event', async () => {
      let closeCalled = false;
      mockWs.onclose = () => {
        closeCalled = true;
      };

      mockWs.simulateClose();
      expect(mockWs.readyState).toBe(3); // CLOSED
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(closeCalled).toBe(true);
    });

    it('should simulate connection failure', async () => {
      let errorReceived: Error | undefined;
      mockWs.onerror = (error) => {
        errorReceived = error;
      };

      mockWs.simulateConnectionFailure();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(errorReceived).toBeDefined();
      expect(errorReceived?.message).toBe('Network failure');
      expect(mockWs.readyState).toBe(3); // CLOSED
    });
  });
});

describe('MockWebSocketConnector', () => {
  let connector: MockWebSocketConnector;

  beforeEach(() => {
    connector = new MockWebSocketConnector('ws://test');
  });

  afterEach(async () => {
    await connector.disposeAsync();
  });

  describe('connection management', () => {
    it('should create mock WebSocket on first connection', async () => {
      expect(connector.mockWs).toBeUndefined();
      
      const vc = await connector.connect();
      expect(connector.mockWs).toBeDefined();
      expect(connector.mockConnection).toBe(connector.mockWs);
      
      await vc.dispose();
    });

    it('should wait for connecting WebSocket', async () => {
      // Start a connection but don't let it complete
      const connectionPromise = connector.connect();
      
      // Mock should be created and in connecting state
      expect(connector.mockWs?.readyState).toBe(0); // CONNECTING
      
      // Creating another virtual connection should wait
      const secondConnectionPromise = connector.connect();
      
      // Manually advance the connection to connected state
      if (connector.mockWs) {
        connector.mockWs.readyState = 1; // OPEN
      }
      
      // Let the connection complete
      await new Promise(resolve => setTimeout(resolve, 15));
      
      const [vc1, vc2] = await Promise.all([connectionPromise, secondConnectionPromise]);
      
      expect(connector.mockWs?.readyState).toBe(1); // OPEN
      
      await vc1.dispose();
      await vc2.dispose();
    });

    it('should wait for connecting WebSocket with polling', async () => {
      // Create a slow-connecting scenario
      const slowConnector = new MockWebSocketConnector('ws://test');
      
      // Start connection and immediately make another request
      const promise1 = slowConnector.connect();
      
      // Force the WebSocket into connecting state and keep it there briefly
      if (slowConnector.mockWs) {
        slowConnector.mockWs.readyState = 0; // Keep CONNECTING
      }
      
      const promise2 = slowConnector.connect();
      
      // Let some polling happen
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Now let it connect
      if (slowConnector.mockWs) {
        slowConnector.mockWs.readyState = 1; // OPEN
      }
      
      const [vc1, vc2] = await Promise.all([promise1, promise2]);
      
      await vc1.dispose();
      await vc2.dispose();
      await slowConnector.disposeAsync();
    });

    it('should reuse existing connected WebSocket', async () => {
      const vc1 = await connector.connect();
      const firstMock = connector.mockWs;
      
      const vc2 = await connector.connect();
      expect(connector.mockWs).toBe(firstMock);
      
      await vc1.dispose();
      await vc2.dispose();
    });
  });

  describe('message handling', () => {
    it('should throw error when sending without connection', async () => {
      const vc = await connector.connect();
      
      // Force disconnect - make mockWs undefined
      (connector as any).mockWs = undefined;
      
      await expect(vc.send('test')).rejects.toThrow('WebSocket not connected');
      
      await vc.dispose();
    });

    it('should throw error when sending with closed connection', async () => {
      const vc = await connector.connect();
      
      // Force close connection
      if (connector.mockWs) {
        connector.mockWs.readyState = 3; // CLOSED
      }
      
      await expect(vc.send('test')).rejects.toThrow('WebSocket not connected');
      
      await vc.dispose();
    });
  });

  describe('disconnection handling', () => {
    it('should handle disconnection when no WebSocket exists', async () => {
      const vc = await connector.connect();
      
      // Remove the mock WebSocket
      (connector as any).mockWs = undefined;
      
      // Should not throw during disposal
      await vc.dispose();
    });

    it('should wait for WebSocket to close', async () => {
      const vc = await connector.connect();
      
      // Start disposal
      const disposePromise = connector.disposeAsync();
      
      // WebSocket should be closing
      expect(connector.mockWs?.readyState).toBe(2); // CLOSING
      
      await disposePromise;
      expect(connector.mockWs?.readyState).toBe(3); // CLOSED
      
      await vc.dispose();
    });

    it('should handle already closed WebSocket during disconnect', async () => {
      const vc = await connector.connect();
      
      // Manually close the WebSocket first
      if (connector.mockWs) {
        connector.mockWs.readyState = 3; // CLOSED
      }
      
      // Should not hang or throw
      await connector.disposeAsync();
      await vc.dispose();
    });
  });

  describe('simulation methods', () => {
    it('should simulate connection', async () => {
      const vc = await connector.connect();
      
      // Reset to connecting state
      if (connector.mockWs) {
        connector.mockWs.readyState = 0;
      }
      
      connector.simulateConnection();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(connector.mockWs?.readyState).toBe(1);
      
      await vc.dispose();
    });

    it('should simulate message', async () => {
      const vc = await connector.connect();
      
      let receivedMessage: any;
      vc.message$.pipe(take(1)).subscribe(message => {
        receivedMessage = message;
      });
      
      connector.simulateMessage('test message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedMessage).toBe('test message');
      
      await vc.dispose();
    });

    it('should simulate error', async () => {
      const vc = await connector.connect();
      
      let receivedError: Error | undefined;
      connector.error$.pipe(take(1)).subscribe(error => {
        receivedError = error;
      });
      
      const testError = new Error('Test error');
      connector.simulateError(testError);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedError).toBe(testError);
      
      await vc.dispose();
    });

    it('should simulate disconnection', async () => {
      const vc = await connector.connect();
      
      const statePromise = firstValueFrom(
        connector.state$.pipe(
          take(2) // Skip initial Connected, get Disconnected
        )
      );
      
      connector.simulateDisconnection();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      const finalState = await firstValueFrom(connector.state$.pipe(take(1)));
      expect(finalState).toBe(WebSocketState.Disconnected);
      
      await vc.dispose();
    });

    it('should simulate connection failure', async () => {
      const vc = await connector.connect();
      
      let receivedError: Error | undefined;
      connector.error$.pipe(take(1)).subscribe(error => {
        receivedError = error;
      });
      
      connector.simulateConnectionFailure();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedError).toBeDefined();
      expect(receivedError?.message).toBe('Network failure');
      
      await vc.dispose();
    });
  });

  describe('edge cases', () => {
    it('should poll connection state until connected', async () => {
      // Create a mock in connecting state but don't auto-complete
      const slowConnector = new MockWebSocketConnector('ws://test');
      slowConnector.mockWs = new MockWebSocket();
      slowConnector.mockWs.readyState = 0; // CONNECTING
      
      // Start connection - this should trigger the polling loop
      const connectionPromise = slowConnector.connect();
      
      // Wait a bit to ensure polling starts (line 106-107)
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Connection should still be in progress
      expect(slowConnector.mockWs.readyState).toBe(0);
      
      // Now complete the connection
      slowConnector.mockWs.readyState = 1; // OPEN
      
      const vc = await connectionPromise;
      expect(vc).toBeDefined();
      
      await vc.dispose();
      await slowConnector.disposeAsync();
    });

    it('should handle simulation methods when no WebSocket exists', () => {
      // Should not throw even with no WebSocket
      expect(() => connector.simulateConnection()).not.toThrow();
      expect(() => connector.simulateMessage('test')).not.toThrow();
      expect(() => connector.simulateError(new Error('test'))).not.toThrow();
      expect(() => connector.simulateDisconnection()).not.toThrow();
      expect(() => connector.simulateConnectionFailure()).not.toThrow();
    });

    it('should return undefined for mockConnection when no WebSocket exists', () => {
      expect(connector.mockConnection).toBeUndefined();
    });
  });
});
