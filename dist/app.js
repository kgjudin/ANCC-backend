"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = __importDefault(require("./routes/index.js"));
const error_middleware_js_1 = require("./middleware/error.middleware.js");
const app = (0, express_1.default)();
// Security Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: true, credentials: true }));
// Rate Limiter
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' }
    }
});
app.use(limiter);
// Body Parsers
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
const path_1 = __importDefault(require("path"));
// API Routes
app.use('/api/v1', index_js_1.default);
// Static Uploads Directory
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Global Error Handler
app.use(error_middleware_js_1.errorHandler);
exports.default = app;
