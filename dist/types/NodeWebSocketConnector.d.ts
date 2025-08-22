/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
import WebSocket from 'ws';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';
import { WebSocketMessage } from './interfaces';
export declare class NodeWebSocketConnector extends WebSocketConnectorBase {
    protected createWebSocket(): WebSocket;
    protected isWebSocketOpen(): boolean;
    protected sendWebSocketMessage(data: WebSocketMessage): void;
    protected setupWebSocketListeners(): void;
    protected closeWebSocket(): Promise<void>;
}
