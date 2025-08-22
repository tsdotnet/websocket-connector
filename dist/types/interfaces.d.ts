import { Observable, Subscription, PartialObserver } from 'rxjs';
import { AsyncDisposable, Disposable } from '@tsdotnet/disposable';
export declare enum WebSocketState {
    Disconnected = "disconnected",
    Connecting = "connecting",
    Connected = "connected",
    Reconnecting = "reconnecting",
    Disconnecting = "disconnecting",
    Disposing = "disposing",
    Disposed = "disposed"
}
export interface WebSocketOptions {
    protocols?: string | string[];
    headers?: Record<string, string>;
    idleTimeoutMs?: number;
    reconnectAttempts?: number;
}
export type WebSocketMessage = string | ArrayBuffer | Uint8Array;
export interface WebSocketConnector extends AsyncDisposable {
    connect(): Promise<WebSocketConnection>;
    readonly state$: Observable<WebSocketState>;
    readonly error$: Observable<Error>;
    readonly activeVirtualConnections: number;
}
export interface WebSocketConnection extends Disposable {
    readonly message$: Observable<WebSocketMessage>;
    send(data: WebSocketMessage): Promise<void>;
    subscribe(observer?: PartialObserver<WebSocketMessage> | ((value: WebSocketMessage) => void)): Subscription;
}
