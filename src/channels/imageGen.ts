// src/channels/imageGen.ts — free, no-API-key image generation for Instagram.
//
// Gemini's image model (gemini-2.5-flash-image) has a hard 0 free-tier quota
// on this project (confirmed via a real call — RESOURCE_EXHAUSTED with
// limit: 0, not just rate-limited), and Cloudflare Workers AI isn't
// configured. Pollinations.ai is genuinely free, keyless, and matches the
// "no credit card, ever" constraint the rest of this project follows.

export async function generateImage(prompt: string): Promise<Buffer> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
