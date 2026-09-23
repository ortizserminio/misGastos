// Shared helpers for Vercel functions. Files starting with "_" are not exposed as routes.
export const json = (res, status, body) => {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
};

export class ApiError extends Error {
  constructor(status, error, message, upstream) { super(message); this.status = status; this.error = error; this.upstream = upstream; }
}

export function fail(message) { throw new ApiError(422, 'validation_error', message); }

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(500, 'configuration_error', 'Faltan variables de Supabase en Vercel.');
  return { url: url.replace(/\/$/, ''), key };
}

// Calls Supabase with the service role key. `path` is relative to the project URL, e.g. "rest/v1/table".
export async function supabase(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new ApiError(502, 'database_error', `Supabase respondió HTTP ${response.status}: ${detail}`, response.status);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export function sendError(res, error) {
  return json(res, error instanceof ApiError ? error.status : 500, { error: error.error ?? 'internal_error', message: error.message ?? 'Error interno.' });
}
