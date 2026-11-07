import {createServer} from "node:http";
import {randomUUID, timingSafeEqual} from "node:crypto";
import {readFileSync} from "node:fs";
import tls from "node:tls";
import {buildCot} from "./cot.mjs";

const TOKENS = {
  excon: process.env.TDG_EXCON_TOKEN || "",
  player: process.env.TDG_PLAYER_TOKEN || "",
  observer: process.env.TDG_OBSERVER_TOKEN || ""
};
if (Object.values(TOKENS).some((value) => value.length < 24) ||
    new Set(Object.values(TOKENS)).size !== 3) {
  throw new Error("Set three distinct TDG_*_TOKEN secrets of at least 24 characters.");
}
const PORT = Number(process.env.TDG_PORT || 8787);
const HOST = process.env.TDG_BIND_HOST || "127.0.0.1";
const ORIGIN = process.env.TDG_ALLOWED_ORIGIN || "";
const PUBLISH = process.env.TDG_PUBLISH_ENABLED === "1";
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const sessions = new Map();

function equalToken(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function roleFor(request) {
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const candidate = auth.slice(7);
  return Object.keys(TOKENS).find((role) => equalToken(TOKENS[role], candidate)) || null;
}
function json(response, status, data) {
  response.writeHead(status, {"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  response.end(JSON.stringify(data));
}
function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin && (!ORIGIN || origin !== ORIGIN)) return false;
  if (origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-headers", "Authorization, Content-Type");
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  }
  return true;
}
async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 12_000) throw new Error("Payload exceeds 12KB");
  }
  return JSON.parse(raw || "{}");
}
function record(session, data) {
  const event = {...data, seq: ++session.seq, at: new Date().toISOString()};
  session.events.push(event);
  if (session.events.length > 5000) session.events.shift();
  for (const subscriber of session.subscribers) {
    if (event.visibility === "excon" && subscriber.role !== "excon") continue;
    subscriber.response.write("data: " + JSON.stringify(event) + "\n\n");
  }
  return event;
}
async function publishCot(xml) {
  if (!PUBLISH) return "dry-run";
  if (!process.env.TDG_TAK_HOST || !process.env.TDG_TAK_CERT_FILE ||
      !process.env.TDG_TAK_KEY_FILE || !process.env.TDG_TAK_CA_FILE) {
    throw new Error("TAK publishing enabled but mTLS configuration is incomplete");
  }
  const options = {
    host:process.env.TDG_TAK_HOST,
    servername:process.env.TDG_TAK_SERVER_NAME || process.env.TDG_TAK_HOST,
    port:Number(process.env.TDG_TAK_PORT || 8089),
    cert:readFileSync(process.env.TDG_TAK_CERT_FILE),
    key:readFileSync(process.env.TDG_TAK_KEY_FILE),
    ca:readFileSync(process.env.TDG_TAK_CA_FILE),
    rejectUnauthorized:true
  };
  return new Promise((resolve, reject) => {
    const socket = tls.connect(options, () => {
      socket.write(xml, (err) => {
        if (err) {socket.destroy(); reject(err); return;}
        socket.end();
        resolve("sent-to-server");
      });
    });
    socket.setTimeout(5000, () => socket.destroy(new Error("TAK connection timed out")));
    socket.on("error", reject);
  });
}
function requireRole(response, role, allowed) {
  if (!role || !allowed.includes(role)) {
    json(response, 403, {error:"Unauthorized for this training role"});
    return false;
  }
  return true;
}
const app = createServer(async (req, res) => {
  try {
    if (!setCors(req, res)) return json(res, 403, {error:"Origin is not allowed"});
    if (req.method === "OPTIONS") {res.writeHead(204); return res.end();}
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return json(res, 200, {ok:true, takPublishEnabled:PUBLISH, sessions:sessions.size});
    const role = roleFor(req);
    if (url.pathname === "/v1/sessions" && req.method === "POST") {
      if (!requireRole(res, role, ["excon"])) return;
      const body = await readJson(req);
      if (typeof body.scenarioId !== "string" || !SAFE_ID.test(body.scenarioId)) return json(res, 400, {error:"Invalid scenarioId"});
      const id = randomUUID().replaceAll("-", "").slice(0, 16);
      sessions.set(id, {id, scenarioId:body.scenarioId, seq:0, events:[], subscribers:new Set()});
      return json(res, 201, {sessionId:id, scenarioId:body.scenarioId});
    }
    const m = /^\\/v1\\/sessions\\/([A-Za-z0-9_-]+)(?:\\/(events|stream|inject|game-event))?$/.exec(url.pathname);
    if (!m) return json(res, 404, {error:"Unknown endpoint"});
    const session = sessions.get(m[1]);
    if (!session) return json(res, 404, {error:"Unknown session"});
    if (!requireRole(res, role, ["excon","player","observer"])) return;
    if (req.method === "GET" && m[2] === "events") {
      return json(res, 200, {sessionId:session.id, scenarioId:session.scenarioId,
        events:session.events.filter((e) => e.visibility !== "excon" || role === "excon")});
    }
    if (req.method === "GET" && m[2] === "stream") {
      res.writeHead(200, {"content-type":"text/event-stream", "cache-control":"no-cache, no-transform", "connection":"keep-alive"});
      res.write(": training stream connected\n\n");
      const sub = {role, response:res}; session.subscribers.add(sub);
      req.on("close", () => session.subscribers.delete(sub));
      return;
    }
    if (req.method === "POST" && m[2] === "inject") {
      if (!requireRole(res, role, ["excon"])) return;
      const body = await readJson(req);
      if (body.visibility !== "player" && body.visibility !== "excon") return json(res, 400, {error:"visibility must be player or excon"});
      const cot = buildCot({...body, sessionId:session.id});
      let delivery = "withheld";
      if (body.visibility === "player") {
        try {delivery = await publishCot(cot);}
        catch (e) {return json(res, 502, {error:"TAK publish failed; no scenario event recorded"});}
      }
      const event = record(session, {kind:"inject", visibility:body.visibility, objectId:body.objectId,
        callsign:body.callsign, affiliation:body.affiliation, lat:body.lat, lon:body.lon, delivery});
      return json(res, 201, {event, cotPreview:PUBLISH ? undefined : cot});
    }
    if (req.method === "POST" && m[2] === "game-event") {
      if (!requireRole(res, role, ["player"])) return;
      const body = await readJson(req);
      if (!["scenario-started","decision-committed","aar-opened"].includes(body.type) ||
          body.scenarioId !== session.scenarioId ||
          typeof body.runId !== "string" || !SAFE_ID.test(body.runId)) {
        return json(res, 400, {error:"Invalid game event or scenario mismatch"});
      }
      if (body.mode !== undefined && !["easy","medium","hard"].includes(body.mode)) return json(res,400,{error:"Invalid mode"});
      const decisionIndex = body.decisionIndex;
      if (decisionIndex !== undefined && (!Number.isInteger(decisionIndex) || decisionIndex < 0 || decisionIndex > 50)) {
        return json(res,400,{error:"Invalid decisionIndex"});
      }
      const event = record(session, {kind:body.type, visibility:"player",
        scenarioId:body.scenarioId, runId:body.runId, mode:body.mode || null,
        decisionIndex:decisionIndex ?? null});
      return json(res, 201, {event});
    }
    return json(res, 404, {error:"Unsupported operation"});
  } catch (e) {
    const badRequest = e instanceof SyntaxError || /Payload exceeds/.test(e.message);
    return json(res, badRequest ? 400 : 500, {error:badRequest ? "Invalid JSON payload" : "Server error"});
  }
});
app.listen(PORT, HOST, () => {
  process.stdout.write("TDG training bridge running on " + HOST + ":" + PORT + " (CoT " + (PUBLISH ? "enabled" : "dry-run") + ")\n");
});
