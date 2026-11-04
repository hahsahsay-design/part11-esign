import { generate } from "otplib";

export async function totpCode(secret: string): Promise<string> {
  return generate({ secret });
}
