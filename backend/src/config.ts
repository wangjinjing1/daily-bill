import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const projectRoot = path.resolve(process.cwd(), "..");
const envPath = path.resolve(projectRoot, ".env.example");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 13101),
  dbHost: requireEnv("DB_HOST", "localhost"),
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: requireEnv("DB_NAME", "daily_bill"),
  dbUser: requireEnv("DB_USER", "daily_bill"),
  dbPassword: requireEnv("DB_PASSWORD", "daily_bill123"),
  jwtSecret: requireEnv("JWT_SECRET"),
  superAdminUsername: requireEnv("SUPER_ADMIN_USERNAME", "admin"),
  superAdminPassword: requireEnv("SUPER_ADMIN_PASSWORD", "admin123456"),
  corsOrigin: requireEnv("CORS_ORIGIN", "http://localhost:5173")
};
