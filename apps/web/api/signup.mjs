import { json, ApiError, fail, supabase, sendError } from './_supabase.mjs';

function input(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('JSON no válido.');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Escribe un email válido.');
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 72) fail('La contraseña debe tener entre 8 y 72 caracteres.');
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 64) fail('Escribe el código de invitación.');
  return { email, password: body.password, code };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Usa POST.');
    const { email, password, code } = input(req.body);
    const accepted = await supabase('rest/v1/rpc/consume_invite', { method: 'POST', body: JSON.stringify({ p_code: code }) });
    if (accepted !== true) throw new ApiError(403, 'invalid_invite', 'El código de invitación no es válido o ya se ha usado.');
    try {
      await supabase('auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
    } catch (error) {
      await supabase('rest/v1/rpc/refund_invite', { method: 'POST', body: JSON.stringify({ p_code: code }) }).catch(() => {});
      if (error instanceof ApiError && error.upstream === 422) throw new ApiError(409, 'email_exists', 'Ya existe una cuenta con ese email.');
      throw error;
    }
    return json(res, 201, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
}
