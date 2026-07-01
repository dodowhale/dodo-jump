import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { SolidPlugin } from "bun-plugin-solid";

const PORT = 3001;

console.log("Building project...");
await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  naming: "[name].js",
  plugins: [SolidPlugin()],
  minify: false,
});

const app = new Hono();

// Simple in-memory leaderboard for Lumina Jump
let leaderboard: { name: string, score: number }[] = [
    { name: "NEON", score: 15 },
    { name: "NOVA", score: 10 },
    { name: "COSMO", score: 8 },
    { name: "JUMP", score: 5 },
    { name: "AURA", score: 3 }
];

app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

// API Routes
app.get("/api/leaderboard", (c) => c.json(leaderboard));
app.post("/api/leaderboard", async (c) => {
    const { name, score } = await c.req.json();
    leaderboard.push({ name, score });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5); // Top 5
    return c.json({ success: true, leaderboard });
});

app.use("/dist/*", serveStatic({ root: "." }));
app.use("/public/*", serveStatic({ root: "." }));
app.use("/assets/*", serveStatic({ root: "." }));

app.get("/manifest.json", async (c) => {
  return c.body(await Bun.file("./manifest.json").text(), 200, {
    "Content-Type": "application/manifest+json; charset=UTF-8"
  });
});

app.get("/sw.js", async (c) => {
  return c.body(await Bun.file("./sw.js").text(), 200, {
    "Content-Type": "application/javascript; charset=UTF-8"
  });
});

app.get("/", async (c) => {
  return c.html(await Bun.file("index.html").text());
});

console.log(`Server running at http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
