import { WebSocketConnectorBase } from './WebSocketConnectorBase';
import { WebSocketMessage, WebSocketState } from './interfaces';
export declare class MockWebSocket {
    onopen?: () => void;
    onmessage?: (event: {
        data: WebSocketMessage;
    }) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    readyState: number;
    send(data: WebSocketMessage): void;
    close(): void;
    simulateOpen(): void;
    simulateMessage(message: WebSocketMessage): void;
    simulateError(error: Error): void;
    simulateClose(): void;
    simulateConnectionFailure(): void;
}
export declare class MockWebSocketConnector extends WebSocketConnectorBase {
    mockWs?: MockWebSocket;
    protected _ensureConnection(): Promise<WebSocketState>;
    protected _sendMessage(data: WebSocketMessage): Promise<void>;
    protected _ensureDisconnect(): Promise<void>;
    private _connectWebSocket;
    private _setupWebSocketListeners;
    simulateConnection(): void;
    simulateMessage(message: WebSocketMessage): void;
    simulateError(error: Error): void;
    simulateDisconnection(): void;
    simulateConnectionFailure(): void;
    get mockConnection(): MockWebSocket | undefined;
}
