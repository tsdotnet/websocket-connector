/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 */
import { WebSocketMessage, WebSocketState, WebSocketOptions } from './interfaces';
import { WebSocketConnectorBase } from './WebSocketConnectorBase';
export declare class BrowserWebSocketConnector extends WebSocketConnectorBase {
    private _webSocket;
    constructor(url: string, options?: WebSocketOptions);
    protected _ensureConnection(): Promise<WebSocketState>;
    protected _sendMessage(data: WebSocketMessage): Promise<void>;
    protected _ensureDisconnect(): Promise<void>;
    private _connectWebSocket;
    protected _onDisposeAsync(): Promise<void>;
}
