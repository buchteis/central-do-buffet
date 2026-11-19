import { describe, expect, it } from "vitest";
import { canAccessSupport } from "./support-access";

describe("conversas de suporte por cadastro", () => {
  it("permite que o dono veja e envie mensagens no próprio cadastro", () => {
    expect(canAccessSupport("dono-real", "dono-real", false)).toBe(true);
  });
  it("impede que um buffet acesse mensagens de outro cadastro", () => {
    expect(canAccessSupport("dono-real", "dono-infantil", false)).toBe(false);
  });
  it("permite que o super administrador leia e responda a todos os cadastros", () => {
    expect(canAccessSupport("administrador", "dono-infantil", true)).toBe(true);
  });
});