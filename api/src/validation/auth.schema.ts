import { z } from "zod";

export const qCheckUsername = z.object({
  username: z.string().trim().min(1).max(32),
});

const captchaToken = z.string().trim().min(1, "Captcha token is required");

export const bRegister = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100),
  betaCode: z.string().trim().max(64).optional().default(""),
  captchaToken,
});

export const bLogin = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(100),
  captchaToken,
});
