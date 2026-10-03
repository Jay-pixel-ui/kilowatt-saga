import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM, PORT } from "../shared/protocol.js";
import { MissionRoom } from "./rooms/MissionRoom.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Production: one process serves the built client AND the websocket —
// same origin, so wss works anywhere without CORS/proxy gymnastics.
app.use(express.static(path.resolve(__dirname, "../client/dist")));

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});
// filterBy("code"): players who join with the same room code land in the
// same MissionRoom; empty code = the public quick-play pool.
gameServer.define(ROOM, MissionRoom).filterBy(["code"]);

const port = Number(process.env.PORT ?? PORT);
void gameServer.listen(port);
console.log(`[grapnel] server listening on :${port}`);
