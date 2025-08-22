import { describe, it, expect } from 'vitest';
import { WebSocketState } from '../src/interfaces.js';
import { MockWebSocketConnector } from './MockWebSocketConnector.js';

describe('WebSocketConnectorBase', () => {
  it('should create virtual connections', async () => {
    const connector = new MockWebSocketConnector('mock://test');
    
    expect(connector.activeVirtualConnections).toBe(0);
    
    // Should start disconnected
    let currentState: WebSocketState | undefined;
    connector.state$.subscribe(state => currentState = state);
    expect(currentState).toBe(WebSocketState.Disconnected);

    const connection1 = await connector.connect();
    expect(connector.activeVirtualConnections).toBe(1);
    
    const connection2 = await connector.connect();
    expect(connector.activeVirtualConnections).toBe(2);

    // Simulate connection opening
    connector.simulateConnection();
    
    // Wait for physical connection to establish
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(currentState).toBe(WebSocketState.Connected);

    connection1.dispose();
    expect(connector.activeVirtualConnections).toBe(1);

    connection2.dispose();
    expect(connector.activeVirtualConnections).toBe(0);

    await connector.disposeAsync();
  });

  it('should handle messaging', async () => {
    const connector = new MockWebSocketConnector('mock://test');
    const connection = await connector.connect();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test timeout')), 1000);

      connection.message$.subscribe({
        next: (message) => {
          try {
            expect(message).toBe('test message');
            clearTimeout(timeout);
            connection.dispose();
            connector.disposeAsync().then(() => resolve());
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Simulate connection and then send message
      connector.simulateConnection();
      setTimeout(() => {
        connection.send('test message');
      }, 50);
    });
  });
});
