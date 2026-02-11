/**
 * Environment variable validation.
 * Call validateEnv() at server startup to catch missing keys early.
 */

interface EnvConfig {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
}

export function validateEnv(): EnvConfig {
  const missing: string[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === "your-gemini-api-key") {
    missing.push("GEMINI_API_KEY");
  }

  if (missing.length > 0) {
    console.error(
      `\n❌ 必須の環境変数が設定されていません:\n` +
        missing.map((k) => `   - ${k}`).join("\n") +
        `\n\n.env.local ファイルを作成し、.env.example を参考に値を設定してください。\n`
    );
    process.exit(1);
  }

  return {
    GEMINI_API_KEY: geminiKey!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
  };
}

export function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`);
  }
  return value;
}
