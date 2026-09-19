import { createHmac, timingSafeEqual } from "node:crypto";

import { decryptCredentials, encryptCredentials } from "@/lib/integrator/credentials.server";

import { ML_API_BASE, ML_AUTH_BASE } from "./constants";

export * from "./constants";

export type MlTokenSet = {
  accessToken: string;
  refreshToken: string;
  userId: number;
  expiresAt: string;
  scope?: string;
};

export function getMlAppCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env["MERCADOLIVRE_CLIENT_ID"];
  const clientSecret = process.env["MERCADOLIVRE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da aplicação Mercado Livre não configuradas");
  }
  return { clientId, clientSecret };
}

export function getMlRedirectUri(): string {
  return (
    process.env["MERCADOLIVRE_REDIRECT_URI"] ??
    "https://miguelveiculosfsa.com/api/public/integrations/mercadolivre/callback"
  );
}

function stateSecret(): string {
  const raw = process.env["INTEGRATION_CREDENTIALS_KEY"];
  if (!raw) throw new Error("Cofre de integrações não configurado");
  return raw;
}

export function signState(payload: { storeIntegrationId: string; issuedAt: number }): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(state: string): { storeIntegrationId: string } | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      storeIntegrationId: string;
      issuedAt: number;
    };
    if (Date.now() - parsed.issuedAt > 30 * 60 * 1000) return null;
    return { storeIntegrationId: parsed.storeIntegrationId };
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(state: string): string {
  const { clientId } = getMlAppCredentials();
  const url = new URL(ML_AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getMlRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope?: string;
};

async function requestToken(form: Record<string, string>): Promise<MlTokenSet> {
  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    message?: string;
  };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(
      `Falha na autenticação do Mercado Livre (${response.status}): ${payload.error ?? payload.message ?? "erro desconhecido"}`,
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    userId: Number(payload.user_id ?? 0),
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 21600) * 1000).toISOString(),
    ...(payload.scope ? { scope: payload.scope } : {}),
  };
}

export async function exchangeAuthorizationCode(code: string): Promise<MlTokenSet> {
  const { clientId, clientSecret } = getMlAppCredentials();
  return requestToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getMlRedirectUri(),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<MlTokenSet> {
  const { clientId, clientSecret } = getMlAppCredentials();
  return requestToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

export type SupabaseAdmin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function saveTokens(
  supabaseAdmin: SupabaseAdmin,
  storeIntegrationId: string,
  tokens: MlTokenSet,
): Promise<void> {
  const encrypted = encryptCredentials(tokens as unknown as Record<string, unknown>);
  const { data: existing } = await supabaseAdmin
    .from("integration_credentials")
    .select("id")
    .eq("store_integration_id", storeIntegrationId)
    .maybeSingle();

  const row = {
    store_integration_id: storeIntegrationId,
    encrypted_payload: encrypted,
    key_version: 1,
    masked_identifier: `ML ${tokens.userId}`,
    expires_at: tokens.expiresAt,
  };
  const { error } = existing?.id
    ? await supabaseAdmin.from("integration_credentials").update(row).eq("id", existing.id)
    : await supabaseAdmin.from("integration_credentials").insert(row);
  if (error) throw new Error(error.message);
}

/** Returns a valid access token, refreshing (and persisting) it when close to expiry. */
export async function getValidAccessToken(
  supabaseAdmin: SupabaseAdmin,
  storeIntegrationId: string,
): Promise<MlTokenSet> {
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_payload")
    .eq("store_integration_id", storeIntegrationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.encrypted_payload) throw new Error("Conta do Mercado Livre não conectada");

  const tokens = decryptCredentials(data.encrypted_payload) as unknown as MlTokenSet;
  const expiresIn = new Date(tokens.expiresAt).getTime() - Date.now();
  if (expiresIn > 10 * 60 * 1000) return tokens;

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(supabaseAdmin, storeIntegrationId, refreshed);
  return refreshed;
}

export type MlCallResult<T> = {
  ok: boolean;
  status: number;
  body: T | null;
  errorMessage?: string;
  retryAfterSeconds?: number;
};

export async function mlFetch<T>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<MlCallResult<T>> {
  const response = await fetch(`${ML_API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (response.ok) return { ok: true, status: response.status, body: parsed as T };

  const errorBody = parsed as { message?: string; error?: string; cause?: unknown } | null;
  const retryAfter = response.headers.get("retry-after");
  return {
    ok: false,
    status: response.status,
    body: parsed as T,
    errorMessage:
      errorBody?.message ??
      (Array.isArray((errorBody as { cause?: unknown } | null)?.cause) &&
      (errorBody as { cause: unknown[] }).cause.length > 0
        ? `${errorBody?.error ?? "Erro"}: ${(errorBody as { cause: Array<{ message?: string; code?: string }> }).cause.map((c) => c?.message ?? c?.code ?? JSON.stringify(c)).join("; ")}`
        : errorBody?.error) ??
      `Erro ${response.status} do Mercado Livre`,
    ...(retryAfter ? { retryAfterSeconds: Number(retryAfter) } : {}),
  };
}

export function categorizeMlError(
  status: number,
):
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "RATE_LIMIT"
  | "TEMPORARY_PROVIDER"
  | "PERMANENT_PROVIDER"
  | "NETWORK" {
  if (status === 401) return "AUTHENTICATION";
  if (status === 403) return "AUTHORIZATION";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "TEMPORARY_PROVIDER";
  if (status === 400 || status === 404 || status === 409) return "VALIDATION";
  return "PERMANENT_PROVIDER";
}
