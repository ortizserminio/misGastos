// Chat model through an OpenAI-compatible endpoint. By default Google Gemini (free tier);
// change provider with AI_BASE_URL + AI_MODEL + AI_API_KEY in Vercel without touching code.
import { ApiError } from './_supabase.mjs';

export function aiConfig() {
  const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new ApiError(503, 'ai_not_configured', 'El chat con IA no está configurado todavía.');
  return { key, base: (process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, ''), model: process.env.AI_MODEL || 'gemini-3.8-flash' };
}

// One chat-completions call. Returns the assistant message exactly as received, so fields such as
// Gemini's thought signatures (extra_content on tool_calls) are sent back unchanged in the next call.
export async function complete({ messages, tools }) {
  const { key, base, model } = aiConfig();
  let response;
  try {
    response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }) });
  } catch { throw new ApiError(502, 'ai_unreachable', 'No se ha podido contactar con la IA. Inténtalo en un momento.'); }
  if (response.status === 429) throw new ApiError(429, 'ai_rate_limited', 'La IA gratuita ha llegado a su límite por ahora. Prueba dentro de un rato.');
  if (!response.ok) throw new ApiError(502, 'ai_error', `La IA respondió con un error (HTTP ${response.status}).`);
  const body = await response.json().catch(() => null);
  const message = body?.choices?.[0]?.message;
  if (!message) throw new ApiError(502, 'ai_error', 'La IA no devolvió ninguna respuesta.');
  return message;
}
