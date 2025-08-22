import { WebSocketConnectorBase } from '../src/WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from '../src/interfaces';

// Mock WebSocket for testing
export class MockWebSocket {
  onopen?: () => void;
  onmessage?: (event: { data: WebSocketMessage }) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  readyState: number = 0; // CONNECTING initially

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

  close(): void {
    this.readyState = 2; // CLOSING
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose();
    }, 1);
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 1);
  }

  simulateMessage(message: WebSocketMessage): void {
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: message });
      }
    }, 1);
  }

  simulateError(error: Error): void {
    setTimeout(() => {
      if (this.onerror) this.onerror(error);
    }, 1);
  }

  simulateClose(): void {
    this.readyState = 3; // CLOSED
    setTimeout(() => {
      if (this.onclose) this.onclose();
    }, 1);
  }
}

export class MockWebSocketConnector extends WebSocketConnectorBase {
  public mockWs?: MockWebSocket;

  protected async _ensureConnection(): Promise<WebSocketState> {
    if (this.mockWs?.readyState === 1) {
      return WebSocketState.Connected;
    }

    if (this.mockWs?.readyState === 0) {
      return WebSocketState.Connecting;
    }

    return this._connectWebSocket();
  }

  protected async _sendMessage(data: WebSocketMessage): Promise<void> {
    if (!this.mockWs || this.mockWs.readyState !== 1) {
      throw new Error('WebSocket not connected');
    }
    this.mockWs.send(data);
  }

  protected async _ensureDisconnect(): Promise<void> {
    if (this.mockWs) {
      this.mockWs.close();
      // Wait a bit for close event
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async _connectWebSocket(): Promise<WebSocketState> {
    return new Promise<WebSocketState>((resolve) => {
      this.mockWs = new MockWebSocket();
      this._setupWebSocketListeners();
      
      // Simulate async connection
      setTimeout(() => {
        this._updateState(WebSocketState.Connecting);
        resolve(WebSocketState.Connecting);
      }, 1);
    });
  }

  private _setupWebSocketListeners(): void {
    if (!this.mockWs) return;

    this.mockWs.onopen = () => {
      this._updateState(WebSocketState.Connected);
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

  protected _onDisposeAsync(): Promise<void> {
    return this._ensureDisconnect();
  }

  // Test helpers
  simulateConnection(): void {
    if (this.mockWs) {
      this.mockWs.simulateOpen();
    }
  }

  simulateMessage(message: WebSocketMessage): void {
    if (this.mockWs) {
      this.mockWs.simulateMessage(message);
    }
  }

  simulateError(error: Error): void {
    if (this.mockWs) {
      this.mockWs.simulateError(error);
    }
  }

  simulateDisconnection(): void {
    if (this.mockWs) {
      this.mockWs.simulateClose();
    }
  }
}
