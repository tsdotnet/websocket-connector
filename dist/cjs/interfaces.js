"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketState = void 0;
var WebSocketState;
(function (WebSocketState) {
    WebSocketState["Disconnected"] = "disconnected";
    WebSocketState["Connecting"] = "connecting";
    WebSocketState["Connected"] = "connected";
    WebSocketState["Reconnecting"] = "reconnecting";
    WebSocketState["Disconnecting"] = "disconnecting";
    WebSocketState["Disposing"] = "disposing";
    WebSocketState["Disposed"] = "disposed";
})(WebSocketState || (exports.WebSocketState = WebSocketState = {}));
//# sourceMappingURL=interfaces.js.map