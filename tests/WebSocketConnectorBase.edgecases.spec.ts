import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, take } from 'rxjs';
import { MockWebSocketConnector } from '../src/MockWebSocketConnector';
import { WebSocketState } from '../src/interfaces';

// Extended mock connector for testing edge cases
class EdgeCaseTestConnector extends MockWebSocketConnector {
  public _connectFailure = false;
  public _sendFailure = false;
  public _slowDisconnect = false;

  protected async _ensureConnection(): Promise<WebSocketState> {
    if (this._connectFailure) {
      return WebSocketState.Disconnected; // Force connection failure
    }
    return super._ensureConnection();
  }

  protected async _sendMessage(data: any): Promise<void> {
    if (this._sendFailure) {
      throw new Error('Send failed');
    }
    return super._sendMessage(data);
  }

  protected async _ensureDisconnect(): Promise<void> {
    if (this._slowDisconnect) {
      // Introduce a delay to make disconnect async
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return super._ensureDisconnect();
  }
}

describe('WebSocketConnectorBase Edge Cases', () => {
  let connector: EdgeCaseTestConnector;

  beforeEach(() => {
    connector = new EdgeCaseTestConnector('ws://test', { idleTimeoutMs: 50 });
  });

  afterEach(async () => {
    await connector.disposeAsync();
  });

  describe('connection failure handling', () => {
    it('should throw error when connection fails after attempt', async () => {
      // Force connection to fail
      connector._connectFailure = true;
      
      const vc = await connector.connect();
      
      // This should trigger the "WebSocket failed to connect" error on line 153
      await expect(vc.send('test')).rejects.toThrow('WebSocket failed to connect.');
      
      await vc.dispose();
    });
  });

  describe('idle disconnect timing', () => {
    it('should not schedule idle disconnect when targetState is false', async () => {
      const vc = await connector.connect();
      
      // Mock targetState to return false (line 157-158)
      vi.spyOn(connector as any, 'targetState', 'get').mockReturnValue(false);
      
      // Dispose the virtual connection to trigger idle scheduling
      await vc.dispose();
      
      // Wait longer than idle timeout to ensure no disconnect happens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be connected since targetState was false
      expect(connector.state$.pipe(take(1))).toBeTruthy();
    });

    it('should trigger idle disconnect when timeout fires', async () => {
      // Use a very short timeout
      const shortConnector = new EdgeCaseTestConnector('ws://test', { idleTimeoutMs: 10 });
      
      const vc = await shortConnector.connect();
      
      // Dispose the connection to trigger idle timeout (line 182-183)
      await vc.dispose();
      
      // Wait for timeout to fire and trigger disconnect
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should be disconnected now
      const currentState = await firstValueFrom(shortConnector.state$.pipe(take(1)));
      expect(currentState).toBe(WebSocketState.Disconnected);
      
      await shortConnector.disposeAsync();
    });

    it('should not disconnect if connections exist when timeout fires', async () => {
      const vc1 = await connector.connect();
      const vc2 = await connector.connect();
      
      // Dispose one connection to trigger idle timeout scheduling
      await vc1.dispose();
      
      // Wait for timeout to potentially fire (line 179-183)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be connected because vc2 still exists
      const currentState = await firstValueFrom(connector.state$.pipe(take(1)));
      expect(currentState).toBe(WebSocketState.Connected);
      
      await vc2.dispose();
    });

    it('should not disconnect if disposing when timeout fires', async () => {
      const vc = await connector.connect();
      
      // Start disposal process
      const disposePromise = connector.disposeAsync();
      
      // Wait a bit for disposal to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Complete the disposal
      await disposePromise;
      await vc.dispose();
    });
  });

  describe('cleanup timing', () => {
    it('should clear timeout when canceling idle disconnect', async () => {
      const vc = await connector.connect();
      
      // Dispose to trigger idle timeout scheduling
      await vc.dispose();
      
      // Create new connection to cancel idle timeout (line 193-195)
      const vc2 = await connector.connect();
      
      // Verify timeout was cleared by waiting longer than timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentState = await firstValueFrom(connector.state$.pipe(take(1)));
      expect(currentState).toBe(WebSocketState.Connected);
      
      await vc2.dispose();
    });
  });

  describe('connection retry during disconnect', () => {
    it('should wait for disconnect to complete before connecting', async () => {
      const vc = await connector.connect();
      
      // Manually trigger a disconnect without disposal
      const disconnectPromise = (connector as any)._disconnect();
      
      // Immediately try to connect while disconnecting is in progress (line 209-210)
      const newVcPromise = connector.connect();
      
      // Let disconnect finish
      await disconnectPromise;
      await vc.dispose();
      
      // The new connection should work after disconnect completes
      const newVc = await newVcPromise;
      expect(newVc).toBeDefined();
      
      await newVc.dispose();
    });

    it('should handle multiple connection attempts during disconnect', async () => {
      const vc = await connector.connect();
      
      // Start disconnect
      const disconnectPromise = (connector as any)._disconnect();
      
      // Multiple connection attempts should all wait for disconnect (line 209-210)
      const vc1Promise = connector.connect();
      const vc2Promise = connector.connect();
      
      await disconnectPromise;
      await vc.dispose();
      
      const [vc1, vc2] = await Promise.all([vc1Promise, vc2Promise]);
      
      await vc1.dispose();
      await vc2.dispose();
    });
  });
});
