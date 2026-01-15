"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionNotFoundError = void 0;
exports.createSession = createSession;
exports.createMessage = createMessage;
function createSession(type, name, workspace) {
    var now = Date.now();
    return {
        id: "session-".concat(now, "-").concat(Math.random().toString(36).slice(2, 11)),
        type: type,
        name: name,
        workspace: workspace,
        config: {},
        status: 'active',
        createdAt: new Date(now),
        updatedAt: new Date(now)
    };
}
function createMessage(type, content, metadata) {
    var now = Date.now();
    return {
        id: "msg-".concat(now, "-").concat(Math.random().toString(36).slice(2, 11)),
        type: type,
        content: content,
        metadata: metadata,
        timestamp: new Date(now)
    };
}
var SessionNotFoundError = /** @class */ (function (_super) {
    __extends(SessionNotFoundError, _super);
    function SessionNotFoundError(sessionId) {
        var _this = _super.call(this, "Session not found: ".concat(sessionId)) || this;
        _this.name = 'SessionNotFoundError';
        return _this;
    }
    return SessionNotFoundError;
}(Error));
exports.SessionNotFoundError = SessionNotFoundError;
