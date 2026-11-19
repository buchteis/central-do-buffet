import { z } from "zod";

export const supportMessageInput = z.object({
  tenantId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva uma mensagem."),
});

export function canAccessSupport(userId: string, ownerId: string, isSuperAdmin: boolean) {
  return isSuperAdmin || userId === ownerId;
}