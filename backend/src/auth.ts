import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { User } from "./models.js";

export type AuthPayload = {
  userId: number;
  username: string;
  role: "SUPER_ADMIN" | "USER";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(user: User) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    } satisfies AuthPayload,
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}

