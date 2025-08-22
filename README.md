# @tsdotnet/websocket-connector

[![npm version](https://badge.fury.io/js/%40tsdotnet%2Fwebsocket-connector.svg)](https://badge.fury.io/js/%40tsdotnet%2Fwebsocket-connector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Universal WebSocket connector with connection pooling, virtual connections, and comprehensive testing utilities. Built with RxJS observables and TypeScript.

## ✨ Features

- 🔄 **Connection Pooling**: Multiple virtual connections share a single WebSocket
- 🚀 **Lazy Connection**: WebSocket created only when first virtual connection is requested
- 🎯 **Virtual Connections**: Independent message streams for different parts of your application
- 📡 **RxJS Observables**: Reactive streams for messages, errors, and connection states
- 🔌 **Platform Agnostic**: Separate implementations for Browser and Node.js
- 🧪 **Testing Support**: Built-in mock connector for comprehensive testing
- ♻️ **Auto Reconnection**: Optional automatic reconnection with customizable behavior
- 💤 **Idle Disconnection**: Automatic cleanup when no virtual connections are active
- 📦 **TypeScript**: Full type safety with comprehensive interfaces

## 📦 Installation

```bash
npm install @tsdotnet/websocket-connector
```

## 🚀 Quick Start

### Browser Usage

```typescript
import { BrowserWebSocketConnector } from '@tsdotnet/websocket-connector/browser';

const connector = new BrowserWebSocketConnector('wss://api.example.com/ws');

// Create a virtual connection
const connection = await connector.connect();

// Listen for messages (shortcut method)
connection.subscribe(message => {
  console.log('Received:', message);
});

// Send messages
await connection.send('Hello WebSocket!');
await connection.send(new Uint8Array([1, 2, 3, 4])); // Binary data

// Clean up
connection.dispose();
await connector.disposeAsync();
```

### Node.js Usage

```typescript
import { NodeWebSocketConnector } from '@tsdotnet/websocket-connector/node';

const connector = new NodeWebSocketConnector('ws://localhost:8080', {
  headers: { 'Authorization': 'Bearer token123' },
  protocols: ['v1', 'v2'],
  idleTimeoutMs: 30000, // 30 seconds
  reconnectAttempts: 3 // Try to reconnect up to 3 times on failure
});

const connection = await connector.connect();

connection.subscribe({
  next: message => console.log('Message:', message),
  error: err => console.error('Message error:', err),
  complete: () => console.log('Connection closed')
});

await connection.send(JSON.stringify({ type: 'ping' }));
```

## 🎯 Core Concepts

### Virtual Connections

Multiple parts of your application can create independent "virtual" connections that all share the same underlying WebSocket:

```typescript
import { BrowserWebSocketConnector } from '@tsdotnet/websocket-connector/browser';

const connector = new BrowserWebSocketConnector('wss://api.example.com/ws');

// Chat component gets its own virtual connection
const chatConnection = await connector.connect();
chatConnection.subscribe(msg => {
  // Only chat-related logic here
  if (JSON.parse(msg).type === 'chat') {
    updateChatUI(JSON.parse(msg));
  }
});

// Notifications component gets its own virtual connection  
const notificationConnection = await connector.connect();
notificationConnection.subscribe(msg => {
  // Only notification-related logic here
  if (JSON.parse(msg).type === 'notification') {
    showNotification(JSON.parse(msg));
  }
});

// Both share the same underlying WebSocket connection!
console.log(connector.activeVirtualConnections); // 2
```

### Connection States

Monitor the connection lifecycle with reactive state streams:

```typescript
import { WebSocketState } from '@tsdotnet/websocket-connector';

connector.state$.subscribe(state => {
  switch (state) {
    case WebSocketState.Disconnected:
      console.log('Ready to connect');
      break;
    case WebSocketState.Connecting:
      showSpinner(true);
      break;
    case WebSocketState.Connected:
      showSpinner(false);
      break;
    case WebSocketState.Reconnecting:
      showReconnectingBanner();
      break;
    case WebSocketState.Disconnecting:
      console.log('Shutting down...');
      break;
  }
});
```

### Error Handling

Handle connection-level errors separately from message-level concerns:

```typescript
// Connection-level errors (network issues, authentication, etc.)
connector.error$.subscribe(error => {
  console.error('Connection error:', error);
  showErrorBanner(`Connection failed: ${error.message}`);
});

// Message-level errors are handled per virtual connection
connection.message$.subscribe({
  next: message => processMessage(message),
  error: error => console.error('Message processing error:', error)
});
```

## ⚙️ Configuration Options

```typescript
interface WebSocketOptions {
  /** WebSocket sub-protocols */
  protocols?: string | string[];
  
  /** Custom headers (Node.js only) */
  headers?: Record<string, string>;
  
  /** Idle timeout in milliseconds (default: 10000ms) */
  idleTimeoutMs?: number;
  
  /** Number of reconnection attempts on failure (default: 0) */
  reconnectAttempts?: number;
}

const connector = new NodeWebSocketConnector('ws://localhost:8080', {
  protocols: ['graphql-ws', 'graphql-transport-ws'],
  headers: {
    'Authorization': 'Bearer your-token',
    'User-Agent': 'MyApp/1.0'
  },
  idleTimeoutMs: 60000, // 1 minute
  reconnectAttempts: 5 // Try up to 5 times with exponential backoff
});
```

## 🔄 Reconnection Behavior

When `reconnectAttempts` is set to a value greater than 0:

```typescript
const connector = new BrowserWebSocketConnector('wss://api.example.com/ws', {
  reconnectAttempts: 3 // Try up to 3 times with exponential backoff
});

const connection = await connector.connect();

// Monitor reconnection states
connector.state$.subscribe(state => {
  if (state === WebSocketState.Reconnecting) {
    console.log('Connection lost, attempting to reconnect...');
    // Virtual connections remain alive during reconnection
    console.log(`${connector.activeVirtualConnections} connections waiting for reconnect`);
  }
});

// Virtual connections automatically resume after reconnection
connection.subscribe(message => {
  // This will continue receiving messages even after reconnection
  console.log('Message (survives reconnection):', message);
});
```

**Reconnection Strategy:**
- **Exponential Backoff**: 1s, 2s, 4s, 8s, 16s, max 30s
- **Maximum Attempts**: Capped at 10 attempts to prevent abuse
- **Virtual Connection Preservation**: All virtual connections remain alive during reconnection attempts
- **Automatic State Management**: Transitions between `Connected` → `Reconnecting` → `Connected` or `Disconnected`
- **Configurable Attempts**: Set `reconnectAttempts: 0` to disable reconnection entirely

## 🏗️ Advanced Usage

### Message Filtering and Routing

```typescript
import { filter, map } from 'rxjs';

const connector = new BrowserWebSocketConnector('wss://api.example.com/ws');
const connection = await connector.connect();

// Filter and transform messages
const chatMessages$ = connection.message$.pipe(
  map(msg => JSON.parse(msg as string)),
  filter(data => data.type === 'chat'),
  map(data => data.payload)
);

const notifications$ = connection.message$.pipe(
  map(msg => JSON.parse(msg as string)),
  filter(data => data.type === 'notification')
);

chatMessages$.subscribe(payload => updateChatUI(payload));
notifications$.subscribe(notification => showNotification(notification));
```

## 🧪 Testing with MockWebSocketConnector

The library includes a comprehensive mock connector for testing WebSocket functionality without real network connections.

### Basic Mocking

```typescript
import { MockWebSocketConnector } from '@tsdotnet/websocket-connector/mock';

describe('WebSocket functionality', () => {
  let mockConnector: MockWebSocketConnector;
  
  beforeEach(() => {
    mockConnector = new MockWebSocketConnector('ws://test');
  });
  
  afterEach(async () => {
    await mockConnector.disposeAsync();
  });

  it('should handle messages', async () => {
    const connection = await mockConnector.connect();
    
    let receivedMessage: any;
    connection.message$.subscribe(msg => {
      receivedMessage = msg;
    });
    
    // Simulate receiving a message
    mockConnector.simulateMessage('Hello from server!');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(receivedMessage).toBe('Hello from server!');
  });
  
  it('should handle connection errors', async () => {
    const connection = await mockConnector.connect();
    
    let receivedError: Error | undefined;
    mockConnector.error$.subscribe(error => {
      receivedError = error;
    });
    
    // Simulate a connection error
    mockConnector.simulateError(new Error('Connection failed'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(receivedError?.message).toBe('Connection failed');
  });
});
```

### Advanced Testing Scenarios

```typescript
import { WebSocketState } from '@tsdotnet/websocket-connector';
import { firstValueFrom } from 'rxjs';

describe('Advanced WebSocket testing', () => {
  let mockConnector: MockWebSocketConnector;
  
  beforeEach(() => {
    mockConnector = new MockWebSocketConnector('ws://test');
  });
  
  afterEach(async () => {
    await mockConnector.disposeAsync();
  });

  it('should handle connection state changes', async () => {
    const connection = await mockConnector.connect();
    
    const statePromise = firstValueFrom(mockConnector.state$);
    expect(await statePromise).toBe(WebSocketState.Connected);
    
    // Simulate disconnection
    mockConnector.simulateDisconnection();
    
    const disconnectedState = firstValueFrom(mockConnector.state$);
    expect(await disconnectedState).toBe(WebSocketState.Disconnected);
  });
  
  it('should simulate connection failures', async () => {
    const connection = await mockConnector.connect();
    
    let connectionError: Error | undefined;
    mockConnector.error$.subscribe(error => {
      connectionError = error;
    });
    
    // Simulate network failure
    mockConnector.simulateConnectionFailure();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(connectionError?.message).toBe('Network failure');
  });
  
  it('should test message sending', async () => {
    const connection = await mockConnector.connect();
    
    // The mock echoes messages back
    let echoMessage: any;
    connection.message$.subscribe(msg => {
      echoMessage = msg;
    });
    
    await connection.send('Test message');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(echoMessage).toBe('Test message');
  });
  
  it('should test binary data handling', async () => {
    const connection = await mockConnector.connect();
    
    let receivedData: any;
    connection.message$.subscribe(msg => {
      receivedData = msg;
    });
    
    const binaryData = new Uint8Array([1, 2, 3, 4]);
    await connection.send(binaryData);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(receivedData).toEqual(binaryData);
  });
});
```

### Testing Reconnection Logic

```typescript
describe('Reconnection testing', () => {
  it('should maintain virtual connections during reconnection', async () => {
    const mockConnector = new MockWebSocketConnector('ws://test', {
      reconnectAttempts: 3
    });
    
    const connection1 = await mockConnector.connect();
    const connection2 = await mockConnector.connect();
    
    expect(mockConnector.activeVirtualConnections).toBe(2);
    
    // Simulate connection failure (triggers reconnection)
    mockConnector.simulateConnectionFailure();
    
    // Virtual connections should still exist
    expect(mockConnector.activeVirtualConnections).toBe(2);
    
    // Clean up
    await connection1.dispose();
    await connection2.dispose();
    await mockConnector.disposeAsync();
  });
});
```

### Integration Testing

```typescript
class ChatService {
  constructor(private connector: WebSocketConnector) {}
  
  async sendMessage(message: string): Promise<void> {
    const connection = await this.connector.connect();
    await connection.send(JSON.stringify({
      type: 'chat',
      message,
      timestamp: Date.now()
    }));
  }
  
  getMessages$() {
    return from(this.connector.connect()).pipe(
      switchMap(connection => connection.message$),
      map(msg => JSON.parse(msg as string)),
      filter(data => data.type === 'chat')
    );
  }
}

describe('ChatService integration', () => {
  it('should send and receive chat messages', async () => {
    const mockConnector = new MockWebSocketConnector('ws://test');
    const chatService = new ChatService(mockConnector);
    
    let receivedMessage: any;
    chatService.getMessages$().subscribe(msg => {
      receivedMessage = msg;
    });
    
    await chatService.sendMessage('Hello, world!');
    
    // Mock will echo the message back
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(receivedMessage.message).toBe('Hello, world!');
    expect(receivedMessage.type).toBe('chat');
    
    await mockConnector.disposeAsync();
  });
});
```

## 📚 API Reference

### WebSocketConnector Interface

```typescript
interface WebSocketConnector {
  /** Create a virtual connection (lazy initialization) */
  connect(): Promise<WebSocketConnection>;
  
  /** Observable stream of connection state changes */
  readonly state$: Observable<WebSocketState>;
  
  /** Observable stream of connection-level errors */
  readonly error$: Observable<Error>;
  
  /** Number of active virtual connections */
  readonly activeVirtualConnections: number;
  
  /** Dispose the connector and all virtual connections */
  disposeAsync(): Promise<void>;
}
```

### WebSocketConnection Interface

```typescript
interface WebSocketConnection {
  /** Observable stream of incoming messages */
  readonly message$: Observable<WebSocketMessage>;
  
  /** Send a message through the connection */
  send(data: WebSocketMessage): Promise<void>;
  
  /** Convenience method for message$.subscribe() - the most common use case */
  subscribe(observer?: PartialObserver<WebSocketMessage> | ((value: WebSocketMessage) => void)): Subscription;
  
  /** Dispose this virtual connection */
  dispose(): void;
}
```

### WebSocketState Enum

```typescript
enum WebSocketState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Disconnecting = 'disconnecting',
  Disposing = 'disposing',
  Disposed = 'disposed'
}
```

## 🔧 Entry Points

The library provides multiple entry points for different use cases:

```typescript
// Core interfaces and base classes
import { WebSocketState } from '@tsdotnet/websocket-connector';

// Browser implementation
import { BrowserWebSocketConnector } from '@tsdotnet/websocket-connector/browser';

// Node.js implementation  
import { NodeWebSocketConnector } from '@tsdotnet/websocket-connector/node';

// Testing utilities
import { MockWebSocketConnector } from '@tsdotnet/websocket-connector/mock';
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [RxJS](https://rxjs.dev/) for reactive programming
- Uses [@tsdotnet/disposable](https://www.npmjs.com/package/@tsdotnet/disposable) for resource management
- WebSocket implementation via native WebSocket API (browser) and [ws](https://www.npmjs.com/package/ws) (Node.js)
