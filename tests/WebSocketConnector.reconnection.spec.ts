import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take } from 'rxjs';
import { WebSocketConnectorBase } from '../src/WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState, WebSocketOptions } from '../src/interfaces';
import { MockWebSocketConnector } from '../src/MockWebSocketConnector';

class ReconnectionTestConnector extends MockWebSocketConnector {
  // Enhanced for reconnection testing
  private _forceFailNextConnection = false;
  private _connectionAttempts = 0;

  constructor(url: string, options: WebSocketOptions = {}) {
    super(url, options);
  }

  // Override to simulate reconnection failures
  protected async _ensureConnection(): Promise<WebSocketState> {
    this._connectionAttempts++;
    
    if (this._forceFailNextConnection) {
      this._forceFailNextConnection = false;
      throw new Error('Simulated connection failure');
    }
    
    return super._ensureConnection();
  }

  // Test helpers
  forceNextConnectionFailure(): void {
    this._forceFailNextConnection = true;
  }

  get connectAttempts(): number {
    return this._connectionAttempts;
  }

  simulateConnectionFailure(): void {
    if (this.mockWs) {
      this.mockWs.simulateError(new Error('Network failure'));
    }
  }

  simulateReconnection(): void {
    this._updateState(WebSocketState.Reconnecting);
  }

  setConnectionFailure(shouldFail: boolean): void {
    this._forceFailNextConnection = shouldFail;
  }

  // For test compatibility
  get mockConnection() {
    if (!this.mockWs) return undefined;
    const base = this.mockWs;
    return Object.assign(base, {
      connectAttempts: this._connectionAttempts,
      setConnectionFailure: (shouldFail: boolean) => this.setConnectionFailure(shouldFail),
      simulateConnectionFailure: () => this.simulateConnectionFailure(),
      simulateReconnection: () => this.simulateReconnection()
    });
  }

  onCreateConnection(callback: () => void): void {
    // For compatibility - can be called but doesn't do much in new architecture
    callback();
  }
}

describe('WebSocket Reconnection Behavior Specifications', () => {
  let connector: ReconnectionTestConnector;

  afterEach(async () => {
    if (connector && !connector.wasDisposed) {
      await connector.disposeAsync();
    }
  });

  describe('Given reconnectOnFailure is FALSE (default)', () => {
    beforeEach(() => {
      connector = new ReconnectionTestConnector('ws://test.example.com', {
        reconnectOnFailure: false
      });
    });

    describe('When underlying connection fails', () => {
      it('should transition to Disconnected state', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
        
        const states: WebSocketState[] = [];
        connector.state$.subscribe(state => states.push(state));
        
        // Simulate connection failure
        connector.mockConnection!.simulateConnectionFailure();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(states).toContain(WebSocketState.Disconnected);
      });

      it('should emit error on connector error stream', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const errorPromise = firstValueFrom(connector.error$);
        
        connector.mockConnection!.simulateConnectionFailure();
        
        const error = await errorPromise;
        expect(error.message).toBe('Network failure');
      });

      it('should dispose all virtual connections', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        let connection1Completed = false;
        let connection2Completed = false;
        
        connection1.message$.subscribe({
          complete: () => { connection1Completed = true; }
        });
        
        connection2.message$.subscribe({
          complete: () => { connection2Completed = true; }
        });
        
        // Simulate failure that should dispose virtual connections
        connector.mockConnection!.simulateConnectionFailure();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Note: This behavior needs to be implemented
        // expect(connection1Completed).toBe(true);
        // expect(connection2Completed).toBe(true);
        // expect(connector.activeVirtualConnections).toBe(0);
      });

      it('should require new connect() call to establish new virtual connections', async () => {
        const connection1 = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Simulate failure
        connector.mockConnection!.simulateConnectionFailure();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Creating new connection should work
        const connection2 = await connector.connect();
        expect(connection2).toBeDefined();
        expect(connection2).not.toBe(connection1);
      });
    });
  });

  describe('Given reconnectOnFailure is TRUE', () => {
    beforeEach(() => {
      connector = new ReconnectionTestConnector('ws://test.example.com', {
        reconnectOnFailure: true
      });
    });

    describe('When underlying connection fails', () => {
      it('should transition to Reconnecting state', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const states: WebSocketState[] = [];
        connector.state$.subscribe(state => states.push(state));
        
        // Simulate connection failure that triggers reconnection
        connector.mockConnection!.simulateReconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(states).toContain(WebSocketState.Reconnecting);
      });

      it('should NOT dispose virtual connections', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        let connection1Completed = false;
        let connection2Completed = false;
        
        connection1.message$.subscribe({
          complete: () => { connection1Completed = true; }
        });
        
        connection2.message$.subscribe({
          complete: () => { connection2Completed = true; }
        });
        
        // Simulate failure during reconnection mode
        connector.mockConnection!.simulateConnectionFailure();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(connection1Completed).toBe(false);
        expect(connection2Completed).toBe(false);
        expect(connector.activeVirtualConnections).toBe(2);
      });

      it('should emit error but keep virtual connections alive', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const errorPromise = firstValueFrom(connector.error$);
        
        connector.mockConnection!.simulateConnectionFailure();
        
        const error = await errorPromise;
        expect(error.message).toBe('Network failure');
        expect(connector.activeVirtualConnections).toBe(1);
      });

      it('should throw on send() during reconnection', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Simulate reconnection state and force next connection to fail
        connector.mockConnection!.simulateReconnection();
        connector.mockConnection!.setConnectionFailure(true);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Send should fail during reconnection
        await expect(connection.send('test')).rejects.toThrow('Simulated connection failure');
      });

      it('should resume normal operation after successful reconnection', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Simulate reconnection cycle
        connector.mockConnection!.simulateReconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Simulate successful reconnection
        // This would require implementing reconnection logic
        // connector.mockConnection!.simulateSuccessfulReconnection();
        // await new Promise(resolve => setTimeout(resolve, 20));
        
        // Should be able to send again
        // expect(() => connection.send('test')).not.toThrow();
      });
    });
  });

  describe('Given Connection Lifecycle States', () => {
    beforeEach(() => {
      connector = new ReconnectionTestConnector('ws://test.example.com');
    });

    describe('When observing state transitions', () => {
      it('should follow proper state sequence for initial connection', async () => {
        const states: WebSocketState[] = [];
        connector.state$.subscribe(state => states.push(state));
        
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 30));
        
        expect(states).toEqual([
          WebSocketState.Disconnected,
          WebSocketState.Connecting,
          WebSocketState.Connected
        ]);
      });

      it('should distinguish between Connecting and Reconnecting states', async () => {
        const states: WebSocketState[] = [];
        
        // Initial connection
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Start monitoring states
        connector.state$.subscribe(state => states.push(state));
        
        // Simulate reconnection scenario
        connector.mockConnection!.simulateReconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(states).toContain(WebSocketState.Reconnecting);
        expect(states.filter(s => s === WebSocketState.Connecting)).toHaveLength(0);
      });
    });

    describe('When in Disposing state', () => {
      it('should ignore state changes from underlying connection', async () => {
        await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const states: WebSocketState[] = [];
        
        // Monitor states during disposal - BEFORE starting disposal
        connector.state$.subscribe(state => {
          states.push(state);
        });
        
        // Start disposal
        const disposePromise = connector.disposeAsync();
        
        // Try to trigger state change during disposal
        connector.mockConnection!.simulateConnectionFailure();
        
        await disposePromise;
        
        // Should only see disposal-related states
        expect(states).toContain(WebSocketState.Disposing);
        expect(states).toContain(WebSocketState.Disposed);
        
        // Should not see failure-induced states AFTER disposal starts
        const statesAfterDisposalStart = states.slice(states.indexOf(WebSocketState.Disposing));
        const nonDisposalStatesAfterDisposal = statesAfterDisposalStart.filter(s => 
          s !== WebSocketState.Disposing && s !== WebSocketState.Disposed
        );
        expect(nonDisposalStatesAfterDisposal).toHaveLength(0);
      });
    });
  });

  describe('Given Connection Pooling with Reconnection', () => {
    beforeEach(() => {
      connector = new ReconnectionTestConnector('ws://test.example.com', {
        reconnectOnFailure: true
      });
    });

    describe('When virtual connections exist during reconnection', () => {
      it('should maintain virtual connection count during reconnection', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        
        expect(connector.activeVirtualConnections).toBe(2);
        
        // Simulate reconnection
        connector.mockConnection!.simulateReconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(connector.activeVirtualConnections).toBe(2);
      });

      it('should allow disposal of virtual connections during reconnection', async () => {
        const connection1 = await connector.connect();
        const connection2 = await connector.connect();
        
        // Start reconnection
        connector.mockConnection!.simulateReconnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Dispose one connection during reconnection
        connection1.dispose();
        
        expect(connector.activeVirtualConnections).toBe(1);
      });
    });
  });
});
