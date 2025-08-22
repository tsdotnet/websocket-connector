# ![alt text](https://avatars1.githubusercontent.com/u/64487547?s=30 "tsdotnet") tsdotnet / websocket-connector

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/tsdotnet/websocket-connector/blob/master/LICENSE)
![npm-publish](https://github.com/tsdotnet/websocket-connector/workflows/npm-publish/badge.svg)
[![npm version](https://img.shields.io/npm/v/@tsdotnet/websocket-connector.svg?style=flat-square)](https://www.npmjs.com/package/@tsdotnet/websocket-connector)

Universal WebSocket connector base class with connection pooling, virtual connections, and RxJS observables for state management.

## Installation

```bash
npm install @tsdotnet/websocket-connector
```

## Usage

### Basic Example

```typescript
import { WebSocketConnectorBase, WebSocketState } from '@tsdotnet/websocket-connector';

class MyWebSocketConnector extends WebSocketConnectorBase {
  protected createConnection() {
    // Return platform-specific connection implementation
    return new MyPlatformConnection(this.url, this.options);
  }
}

const connector = new MyWebSocketConnector('ws://localhost:8080');

// Get a virtual connection
const connection = await connector.connect();

// Listen for messages
connection.message$.subscribe(message => {
  console.log('Received:', message);
});

// Send messages
connection.send('Hello WebSocket!');

// Monitor connection state
connector.state$.subscribe(state => {
  console.log('Connection state:', state);
});
```

### Advanced Usage

```typescript
// Multiple virtual connections sharing underlying connection
const connection1 = await connector.connect();
const connection2 = await connector.connect();

// Both share the same underlying WebSocket connection
console.log(connector.activeVirtualConnections); // 2

// Dispose individual connections
connection1.dispose();
console.log(connector.activeVirtualConnections); // 1

// Monitor errors at connector level
connector.error$.subscribe(error => {
  console.error('Connection error:', error);
});
```

## API

### Main Classes

#### `WebSocketConnectorBase`

Abstract base class for WebSocket connector implementations with connection pooling and lazy initialization.

**Constructor Parameters:**
- `url: string` - WebSocket server URL
- `options?: WebSocketOptions` - Connection configuration options

**Properties:**
- `state$: Observable<WebSocketState>` - Observable stream of connection state changes
- `error$: Observable<Error>` - Observable stream of connection-level errors  
- `activeVirtualConnections: number` - Number of active virtual connections

**Methods:**
- `connect(): Promise<WebSocketConnection>` - Create a virtual connection (lazy connection creation)
- `disposeAsync(): Promise<void>` - Dispose connector and all virtual connections

#### `WebSocketConnection`

Virtual connection interface for messaging operations.

**Properties:**
- `message$: Observable<WebSocketMessage>` - Observable stream of incoming messages

**Methods:**
- `send(data: WebSocketMessage): void` - Send a message through the connection
- `dispose(): void` - Dispose the virtual connection

### Interfaces

#### `WebSocketOptions`

Configuration options for WebSocket connections.

**Properties:**
- `protocols?: string | string[]` - WebSocket subprotocols
- `headers?: Record<string, string>` - HTTP headers for connection
- `idleTimeout?: number` - Connection idle timeout
- `reconnectOnFailure?: boolean` - Enable automatic reconnection

#### `WebSocketState`

Enumeration of possible connection states:
- `Disconnected` - Not connected
- `Connecting` - Establishing connection
- `Connected` - Successfully connected
- `Reconnecting` - Attempting to reconnect
- `Disconnecting` - Closing connection  
- `Disposing` - Cleaning up resources
- `Disposed` - Fully disposed

## Features

- ✅ **Connection Pooling**: Multiple virtual connections share underlying WebSocket
- ✅ **Lazy Initialization**: Connections created only when needed
- ✅ **State Management**: RxJS observables for state and error tracking
- ✅ **Resource Management**: Proper disposal pattern with @tsdotnet/disposable
- ✅ **Virtual Connections**: Isolated message streams per consumer
- ✅ **Platform Agnostic**: Abstract base for browser/Node.js implementations
- ✅ **Type Safety**: Full TypeScript support with strict typing

## Architecture

The connector uses a **factory pattern** where:
- The `WebSocketConnector` manages the underlying connection lifecycle
- Multiple `WebSocketConnection` instances provide isolated messaging interfaces
- Automatic cleanup when all virtual connections are disposed
- Platform-specific implementations extend the abstract base class

## Requirements

- TypeScript 5.0+
- RxJS 7.0+
- @tsdotnet/disposable 2.0+

## Docs

[tsdotnet.github.io/websocket-connector](https://tsdotnet.github.io/websocket-connector/)

## Contributing

This package is part of the tsdotnet project. Please see the main repository for contribution guidelines.

## License

MIT
