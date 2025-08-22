import { describe, it, expect } from 'vitest';
import { WebSocketConnectorBase, Connection } from '../src/WebSocketConnectorBase.js';
import { WebSocketMessage, WebSocketState } from '../src/interfaces.js';
import { BehaviorSubject, Subject } from 'rxjs';

// Mock implementation for testing
class MockConnection implements Connection {
  private readonly _state$ = new BehaviorSubject<WebSocketState>(WebSocketState.Disconnected);
  private readonly _message$ = new Subject<WebSocketMessage>();
  private readonly _error$ = new Subject<Error>();

  get state$() { return this._state$.asObservable(); }
  get message$() { return this._message$.asObservable(); }
  get error$() { return this._error$.asObservable(); }

  async connect(): Promise<void> {
    this._state$.next(WebSocketState.Connecting);
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 10));
    this._state$.next(WebSocketState.Connected);
  }

  send(data: WebSocketMessage): void {
    if (this._state$.value !== WebSocketState.Connected) {
      throw new Error('Connection not open');
    }
    // Echo the message back for testing
    setTimeout(() => this._message$.next(data), 1);
  }

  async disconnect(): Promise<void> {
    this._state$.next(WebSocketState.Disconnecting);
    await new Promise(resolve => setTimeout(resolve, 5));
    this._state$.next(WebSocketState.Disconnected);
    this._message$.complete();
    this._error$.complete();
    this._state$.complete();
  }
}

class MockWebSocketConnector extends WebSocketConnectorBase {
  protected createConnection(): Connection {
    return new MockConnection();
  }
}

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

      // Wait a bit for connection to establish, then send message
      setTimeout(() => {
        connection.send('test message');
      }, 50);
    });
  });
});
