"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = __importDefault(require("./app.js"));
const env_js_1 = require("./config/env.js");
const PORT = Number(env_js_1.ENV.PORT) || 5000;
const HOST = '0.0.0.0';
app_js_1.default.listen(PORT, HOST, () => {
    console.log(`=================================================`);
    console.log(`  Construction Management System Backend API    `);
    console.log(`  Local:   http://localhost:${PORT}/api/v1       `);
    console.log(`  Network: http://0.0.0.0:${PORT}/api/v1         `);
    console.log(`  Environment: ${env_js_1.ENV.NODE_ENV}                  `);
    console.log(`=================================================`);
});
