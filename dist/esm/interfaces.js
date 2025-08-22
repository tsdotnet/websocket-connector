var WebSocketState;
(function (WebSocketState) {
    WebSocketState["Disconnected"] = "disconnected";
    WebSocketState["Connecting"] = "connecting";
    WebSocketState["Connected"] = "connected";
    WebSocketState["Reconnecting"] = "reconnecting";
    WebSocketState["Disconnecting"] = "disconnecting";
    WebSocketState["Disposing"] = "disposing";
    WebSocketState["Disposed"] = "disposed";
})(WebSocketState || (WebSocketState = {}));

export { WebSocketState };
//# sourceMappingURL=interfaces.js.map
