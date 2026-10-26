// Test helper: forwards PostgreSQL traffic and delays every server reply, so loading states become visible.
import net from "node:net";
const DELAY = Number(process.argv[2] ?? 350);
net.createServer((client) => {
  const upstream = net.connect(5432, "127.0.0.1");
  client.pipe(upstream);
  upstream.on("data", (chunk) => setTimeout(() => client.write(chunk), DELAY));
  const end = () => { client.destroy(); upstream.destroy(); };
  client.on("error", end); upstream.on("error", end); client.on("close", end); upstream.on("close", end);
}).listen(15433, "127.0.0.1", () => console.log("slow proxy on 15433, delay", DELAY, "ms"));
