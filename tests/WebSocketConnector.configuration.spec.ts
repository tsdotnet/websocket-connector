import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketConnectorBase } from '../src/WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState, WebSocketOptions } from '../src/interfaces';
import { MockWebSocketConnector } from '../src/MockWebSocketConnector';
import { BehaviorSubject, Subject } from 'rxjs';

class ConfigurableWebSocketConnector extends MockWebSocketConnector {
  // Expose internal state for testing configuration
  get configuredUrl(): string {
    return this.url;
  }

  get configuredOptions(): WebSocketOptions {
    return this.options;
  }

  // For test compatibility
  get createdConnection() {
    return {
      url: this.url,
      options: this.options
    };
  }
}

describe('WebSocket Configuration Specifications', () => {
  let connector: ConfigurableWebSocketConnector;

  afterEach(async () => {
    if (connector && !connector.wasDisposed) {
      await connector.disposeAsync();
    }
  });

  describe('Given WebSocket URL and Options', () => {
    
    describe('When creating connector with minimal configuration', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket');
      });

      it('should accept URL without options', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.url).toBe('wss://api.example.com/websocket');
        expect(connector.createdConnection!.options).toEqual({});
      });
    });

    describe('When creating connector with protocol options', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket', {
          protocols: ['chat', 'superchat']
        });
      });

      it('should pass protocol configuration to underlying connection', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.options.protocols).toEqual(['chat', 'superchat']);
      });
    });

    describe('When creating connector with single protocol string', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket', {
          protocols: 'chat'
        });
      });

      it('should accept single protocol as string', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.options.protocols).toBe('chat');
      });
    });

    describe('When creating connector with headers', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket', {
          headers: {
            'Authorization': 'Bearer token123',
            'X-Client-Version': '1.0.0'
          }
        });
      });

      it('should pass header configuration to underlying connection', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.options.headers).toEqual({
          'Authorization': 'Bearer token123',
          'X-Client-Version': '1.0.0'
        });
      });
    });

    describe('When creating connector with idle timeout', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket', {
          idleTimeoutMs: 60000 // 1 minute
        });
      });

      it('should pass idle timeout configuration', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.options.idleTimeoutMs).toBe(60000);
      });
    });

    describe('When creating connector with reconnection settings', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://api.example.com/websocket', {
          reconnectAttempts: 3
        });
      });

      it('should pass reconnection configuration', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.options.reconnectAttempts).toBe(3);
      });
    });

    describe('When creating connector with full configuration', () => {
      beforeEach(() => {
        connector = new ConfigurableWebSocketConnector('wss://secure.example.com:8443/ws/v1', {
          protocols: ['v1.protocol', 'fallback'],
          headers: {
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
            'X-API-Key': 'api-key-123',
            'X-Client-ID': 'client-456'
          },
          idleTimeoutMs: 120000,
          reconnectAttempts: 5
        });
      });

      it('should pass all configuration options to underlying connection', async () => {
        await connector.connect();
        
        const options = connector.createdConnection!.options;
        
        expect(options.protocols).toEqual(['v1.protocol', 'fallback']);
        expect(options.headers).toEqual({
          'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
          'X-API-Key': 'api-key-123',
          'X-Client-ID': 'client-456'
        });
        expect(options.idleTimeoutMs).toBe(120000);
        expect(options.reconnectAttempts).toBe(5);
      });

      it('should work with complex URL structures', async () => {
        await connector.connect();
        
        expect(connector.createdConnection!.url).toBe('wss://secure.example.com:8443/ws/v1');
      });
    });
  });

  describe('Given Message Type Support', () => {
    
    beforeEach(() => {
      connector = new ConfigurableWebSocketConnector('ws://test.example.com');
    });

    describe('When sending different message types', () => {
      it('should support string messages', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        expect(() => connection.send('Hello WebSocket')).not.toThrow();
      });

      it('should support ArrayBuffer messages', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const buffer = new ArrayBuffer(8);
        expect(() => connection.send(buffer)).not.toThrow();
      });

      it('should support Uint8Array messages', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const uint8Array = new Uint8Array([1, 2, 3, 4]);
        expect(() => connection.send(uint8Array)).not.toThrow();
      });

      it('should support Buffer messages', async () => {
        const connection = await connector.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const buffer = Buffer.from('test buffer');
        expect(() => connection.send(buffer)).not.toThrow();
      });
    });
  });

  describe('Given URL Validation Scenarios', () => {
    
    describe('When using different WebSocket URL schemes', () => {
      it('should accept ws:// URLs', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('ws://example.com');
        }).not.toThrow();
      });

      it('should accept wss:// URLs', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('wss://secure.example.com');
        }).not.toThrow();
      });

      it('should accept URLs with ports', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('ws://localhost:8080/socket');
        }).not.toThrow();
      });

      it('should accept URLs with paths and query parameters', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('wss://api.example.com/v1/websocket?token=abc123&version=2');
        }).not.toThrow();
      });
    });
  });

  describe('Given Options Validation', () => {
    
    describe('When providing invalid option types', () => {
      it('should handle undefined options gracefully', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('ws://example.com', undefined);
        }).not.toThrow();
      });

      it('should handle empty options object', () => {
        expect(() => {
          new ConfigurableWebSocketConnector('ws://example.com', {});
        }).not.toThrow();
      });
    });

    describe('When providing optional configuration', () => {
      it('should work with only some options specified', async () => {
        connector = new ConfigurableWebSocketConnector('ws://example.com', {
          protocols: 'test-protocol'
          // Other options omitted intentionally
        });
        
        await connector.connect();
        
        const options = connector.createdConnection!.options;
        expect(options.protocols).toBe('test-protocol');
        expect(options.headers).toBeUndefined();
        expect(options.idleTimeoutMs).toBeUndefined();
        expect(options.reconnectAttempts).toBeUndefined();
      });
    });
  });
});
