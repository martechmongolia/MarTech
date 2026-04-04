function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  };
}

export function getMetaEnv() {
  return {
    appId: getRequiredEnv("META_APP_ID"),
    appSecret: getRequiredEnv("META_APP_SECRET"),
    redirectUri: getRequiredEnv("META_REDIRECT_URI"),
    apiVersion: process.env.META_API_VERSION || "v20.0",
    tokenEncryptionKey: getRequiredEnv("META_TOKEN_ENCRYPTION_KEY")
  };
}

export function getFacebookAiEnv() {
  return {
    appId: process.env.FACEBOOK_APP_ID ?? "",
    appSecret: process.env.FACEBOOK_APP_SECRET ?? "",
    webhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? ""
  };
}

export function getOpenAiKey(): string {
  return process.env.OPENAI_API_KEY ?? "";
}
