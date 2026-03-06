import { z } from "zod";

export const bVerifyLogin2FA = z.object({
  challengeId: z.string().min(10),
  code: z.string().min(6).max(12),
});
