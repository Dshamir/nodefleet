import { config } from './config';

let currentToken: string | null = null;
let tokenExpiry = 0;

export async function authenticate(): Promise<string> {
  // If token is still valid (with 30s buffer), reuse it
  if (currentToken && Date.now() < tokenExpiry - 30_000) {
    return currentToken;
  }

  console.log(`[Auth] Authenticating as ${config.gatewayEmail}...`);

  const res = await fetch(
    `${config.keycloakUrl}/realms/zenzers/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'medical-app-client',
        username: config.gatewayEmail,
        password: config.gatewayPassword,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Authentication failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  currentToken = data.access_token;
  // expires_in is in seconds
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  console.log(`[Auth] Authenticated successfully (expires in ${data.expires_in}s)`);
  return currentToken!;
}

export function getToken(): string | null {
  return currentToken;
}
