import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  organizationName: z.string().trim().min(2).max(160),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const mfaChallengeSchema = z.object({
  code: z.string().trim().min(6).max(20),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200),
});
