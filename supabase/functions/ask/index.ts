// Supabase Edge Function "ask": lets Blueprint ask Claude to read board photos, scans and COAs,
// describe feed photos, and translate messages.
// Needs one secret: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
// Optional secret CLAUDE_MODEL to choose the model.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Img = { media_type?: string; data?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Only signed-in team members may use it (keeps the Claude bill yours).
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: ok, error: memberErr } = await sb.rpc("is_member");
  if (memberErr || ok !== true) return json({ error: "Not on the team" }, 403);

  let prompt = "", images: Img[] = [], wantJson = false;
  try {
    const b = await req.json();
    prompt = String(b.prompt ?? "");
    images = Array.isArray(b.images) ? b.images.slice(0, 8) : [];
    wantJson = !!b.json;
  } catch { return json({ error: "Bad request" }, 400); }
  if (!prompt || prompt.length > 30000) return json({ error: "Prompt missing or too long" }, 400);

  const content: unknown[] = [];
  for (const im of images) {
    const mt = /^image\/(jpeg|png|gif|webp)$/.test(im.media_type ?? "") ? im.media_type : "image/jpeg";
    if (typeof im.data === "string" && im.data.length < 8_000_000) content.push({ type: "image", source: { type: "base64", media_type: mt, data: im.data } });
  }
  content.push({ type: "text", text: prompt });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 4096,
      system: wantJson ? "Answer with a single valid JSON value and nothing else." : undefined,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) return json({ error: "Claude API error " + r.status + ": " + (await r.text()).slice(0, 300) }, 502);
  const j = await r.json();
  const text = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return json({ text });
});
