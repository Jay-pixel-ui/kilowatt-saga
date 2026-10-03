/** Squad rooms: same code → same room, different code → different rooms. */
import { Client } from "colyseus.js";
import "../server/index.js";
await new Promise(r => setTimeout(r, 800));

const url = "ws://localhost:2567";
const a = await new Client(url).joinOrCreate("mission", { name: "SquadA1", code: "WOLF" });
const b = await new Client(url).joinOrCreate("mission", { name: "SquadA2", code: "WOLF" });
const c = await new Client(url).joinOrCreate("mission", { name: "SquadB1", code: "HAWK" });
const d = await new Client(url).joinOrCreate("mission", { name: "Public1", code: "" });
await new Promise(r => setTimeout(r, 400));

console.log("same code same room:", a.roomId === b.roomId ? "PASS" : `FAIL (${a.roomId} vs ${b.roomId})`);
console.log("diff code diff room:", a.roomId !== c.roomId ? "PASS" : "FAIL");
console.log("public separate from squads:", d.roomId !== a.roomId && d.roomId !== c.roomId ? "PASS" : "FAIL");
console.log("squad sees teammate:", (a.state as any).players.size === 2 ? "PASS" : `FAIL (${(a.state as any).players.size})`);
console.log("solo squad isolated:", (c.state as any).players.size === 1 ? "PASS" : "FAIL");
process.exit(0);
