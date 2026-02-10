/**
 * Standalone WebSocket server for voice chat
 * Run with: npx tsx server.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createWebSocketServer } from "./src/lib/websocket/server";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);

createWebSocketServer(PORT);
console.log(`WebSocket server started on port ${PORT}`);
