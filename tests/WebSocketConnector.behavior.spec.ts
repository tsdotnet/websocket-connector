import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { WebSocketConnectorBase } from '../src/WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from '../src/interfaces';
import { MockWebSocketConnector } from './MockWebSocketConnector';

class TestableWebSocketConnector extends MockWebSocketConnector {
  // Expose internal state for testing
  get activeVirtualConnections(): number {
    return (this as any)._virtualConnections.size;
  }

  // For test compatibility, override mockConnection with additional methods
  get mockConnection() {
    if (!this.mockWs) return undefined;
    const base = this.mockWs;
    return Object.assign(base, {
      simulateConnectionFailure: () => this.simulateConnectionFailure(),
      simulateDisconnection: () => this.simulateDisconnection()
    });
  }
}

describe('WebSocket Connector Behavior Specifications', () => {
  let connector: TestableWebSocketConnector;

  beforeEach(() => {
    connector = new TestableWebSocketConnector('ws://test.example.com');
  });

  afterEach(async () => {
    if (!connector.wasDisposed) {
      await connector.disposeAsync();
    }
  });

  describe('Given a WebSocket Connector', () => {
    
    describe('When initially created', () => {
      it('should be in Disconnected state', async () => {
        expect(connector.state$).toBeDefined();
        await expect(firstValueFrom(connector.state$.pipe(take(1)))).resolves.toBe(WebSocketState.Disconnected);
      });

      it('should have zero active virtual connections', () => {
        expect(connector.activeVirtualConnections).toBe(0);
      });

      it('should provide an error observable', () => {
        expect(connector.error$).toBeDefined();
      });
    });

    describe('When creating the first virtual connection', () => {
      it('should create underlying connection lazily', async () => {
        const connection = await connector.connect();
        
        expect(connection).toBeDefined();
        expect(connector.mockConnection).toBeDefined();
        expect(connector.activeVirtualConnections).toBe(1);
      });

      it('should transition through Connecting to Connected state', async () => {
        const states: WebSocketState[] = [];
        const subscription = connector.state$.subscribe(state => states.push(state));
        
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20)); // Allow state transitions
        
        expect(states).toEqual([
          WebSocketState.Disconnected,
          WebSocketState.Connecting, 
          WebSocketState.Connected
        ]);
        
        subscription.unsubscribe();
      });
    });

    describe('When creating multiple virtual connections', () => {
      it('should reuse the same underlying connection', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        
        expect(connector.activeVirtualConnections).toBe(2);
        expect(connection1).toBeDefined();
        expect(connection2).toBeDefined();
        expect(connection1).not.toBe(connection2); // Different virtual connections
      });

      it('should not create multiple underlying connections', async () => {
        await connector.connect();
        const firstMockConnection = connector.mockConnection;
        
        await connector.connect();
        const secondMockConnection = connector.mockConnection;
        
        expect(firstMockConnection).toBe(secondMockConnection); // Same underlying connection
      });
    });
  });

  describe('Given a Virtual WebSocket Connection', () => {
    
    describe('When receiving messages', () => {
      it('should forward messages from underlying connection', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
        
        const messagePromise = firstValueFrom(connection.message$);
        
        connector.mockConnection!.simulateMessage('test message');
        
        const receivedMessage = await messagePromise;
        expect(receivedMessage).toBe('test message');
      });

      it('should allow multiple virtual connections to receive the same message', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const message1Promise = firstValueFrom(connection1.message$);
        const message2Promise = firstValueFrom(connection2.message$);
        
        connector.mockConnection!.simulateMessage('broadcast message');
        
        const [msg1, msg2] = await Promise.all([message1Promise, message2Promise]);
        expect(msg1).toBe('broadcast message');
        expect(msg2).toBe('broadcast message');
      });
    });

    describe('When sending messages', () => {
      it('should send through underlying connection when connected', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
        
        const sendSpy = vi.spyOn(connector.mockConnection!, 'send');
        
        await connection.send('test message');
        
        expect(sendSpy).toHaveBeenCalledWith('test message');
      });

      it('should throw error when trying to send from disposed connection', async () => {
        const connection = await connector.connect();
        connection.dispose();
        
        await expect(() => connection.send('test')).rejects.toThrow('Object \'VirtualWebSocketConnection\' has been disposed and cannot be used.');
      });
    });

    describe('When disposed', () => {
      it('should complete its message stream', async () => {
        const connection = await connector.connect();
        
        let completed = false;
        connection.message$.subscribe({
          complete: () => { completed = true; }
        });
        
        connection.dispose();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(completed).toBe(true);
      });

      it('should be removed from connector\'s active connections', async () => {
        const connection = await connector.connect();
        expect(connector.activeVirtualConnections).toBe(1);
        
        connection.dispose();
        
        expect(connector.activeVirtualConnections).toBe(0);
      });
    });
  });

  describe('Given Connection Pool Management', () => {
    
    describe('When all virtual connections are disposed', () => {
      it('should disconnect underlying connection after idle period', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        
        connection1.dispose();
        connection2.dispose();
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow cleanup
        
        expect(connector.activeVirtualConnections).toBe(0);
      });
    });

    describe('When connector is disposed', () => {
      it('should dispose all virtual connections', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        
        let connection1Completed = false;
        let connection2Completed = false;
        
        connection1.message$.subscribe({
          complete: () => { connection1Completed = true; }
        });
        
        connection2.message$.subscribe({
          complete: () => { connection2Completed = true; }
        });
        
        await connector.disposeAsync();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(connection1Completed).toBe(true);
        expect(connection2Completed).toBe(true);
        expect(connector.activeVirtualConnections).toBe(0);
      });

      it('should transition to Disposing then Disposed state', async () => {
        const states: WebSocketState[] = [];
        const subscription = connector.state$.subscribe(state => states.push(state));
        
        await connector.connect(); // Get to Connected state
        await new Promise(resolve => setTimeout(resolve, 20));
        
        await connector.disposeAsync();
        
        expect(states).toContain(WebSocketState.Disposing);
        expect(states).toContain(WebSocketState.Disposed);
        
        subscription.unsubscribe();
      });

      it('should complete state and error observables', async () => {
        let stateCompleted = false;
        let errorCompleted = false;
        
        connector.state$.subscribe({
          complete: () => { stateCompleted = true; }
        });
        
        connector.error$.subscribe({
          complete: () => { errorCompleted = true; }
        });
        
        await connector.disposeAsync();
        
        expect(stateCompleted).toBe(true);
        expect(errorCompleted).toBe(true);
      });

      it('should prevent creating new connections after disposal', async () => {
        await connector.disposeAsync();

        await expect(connector.connect()).rejects.toThrow('Object \'TestableWebSocketConnector\' has been disposed and cannot be used.');
      });
    });
  });

  describe('Given Error Handling', () => {
    
    describe('When underlying connection errors', () => {
      it('should forward errors to connector error stream', async () => {
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const errorPromise = firstValueFrom(connector.error$);
        const testError = new Error('Connection failed');
        
        connector.mockConnection!.simulateError(testError);
        
        const receivedError = await errorPromise;
        expect(receivedError).toBe(testError);
      });

      it('should NOT forward errors to virtual connection message streams', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        let messageStreamErrored = false;
        connection.message$.subscribe({
          error: () => { messageStreamErrored = true; }
        });
        
        connector.mockConnection!.simulateError(new Error('Test error'));
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(messageStreamErrored).toBe(false);
      });
    });
  });

  describe('Given State Management', () => {
    
    describe('When connection state changes', () => {
      it('should reflect underlying connection state changes', async () => {
        const states: WebSocketState[] = [];
        connector.state$.subscribe(state => states.push(state));
        
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 30));
        
        // Simulate disconnection
        connector.mockConnection!.simulateDisconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(states).toContain(WebSocketState.Connecting);
        expect(states).toContain(WebSocketState.Connected);
        expect(states).toContain(WebSocketState.Disconnected);
      });
    });

    describe('When in disposal states', () => {
      it('should not update state from underlying connection during disposal', async () => {
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const states: WebSocketState[] = [];
        
        // Subscribe to all states BEFORE disposal starts
        connector.state$.subscribe(state => {
          states.push(state);
        });
        
        // Start disposal process
        const disposePromise = connector.disposeAsync();
        
        // Try to change underlying connection state during disposal
        connector.mockConnection!.simulateDisconnection();
        
        await disposePromise;
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Should only see disposal states after disposal starts, not the simulated disconnection
        const disposalStates = states.filter(s => 
          s === WebSocketState.Disposing || s === WebSocketState.Disposed
        );
        expect(disposalStates).toContain(WebSocketState.Disposing);
        expect(disposalStates).toContain(WebSocketState.Disposed);
        
        // Should not see disconnected state after disposal starts
        const statesAfterDisposalStart = states.slice(states.indexOf(WebSocketState.Disposing));
        expect(statesAfterDisposalStart.filter(s => s === WebSocketState.Disconnected)).toHaveLength(0);
      });
    });
  });
});
