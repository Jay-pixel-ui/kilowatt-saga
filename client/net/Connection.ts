import { Client, Room, getStateCallbacks } from "colyseus.js";
import { ROOM, PORT } from "../../shared/protocol.js";

/**
 * Dev:  client on :5173 (vite), server on :2567 → connect by hostname.
 * Prod: the server serves the built client → same origin, same port.
 */
export async function connect(
  name?: string,
  code = ""
): Promise<{
  room: Room;
  $: ReturnType<typeof getStateCallbacks>;
}> {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const endpoint = import.meta.env.DEV
    ? `${proto}://${location.hostname}:${PORT}`
    : `${proto}://${location.host}`;

  const client = new Client(endpoint);
  // `code` groups players via the server's filterBy — same code, same room.
  const room = await client.joinOrCreate(ROOM, { name, code });
  return { room, $: getStateCallbacks(room) };
}
