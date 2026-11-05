import { describe, expect, it } from "vitest";
import { isConfirmedBookingReply } from "./whatsapp-agent.server";

describe("WhatsApp booking confirmation", () => {
  it("accepts a clear confirmation after a complete summary", () => {
    expect(
      isConfirmedBookingReply(
        "Sim, pode fechar!",
        "Evento em 10/12/2026, pacote Ouro para 60 pessoas, valor R$ 5.000. Você confirma?",
      ),
    ).toBe(true);
  });

  it("does not treat a generic yes or a qualified response as booking consent", () => {
    expect(isConfirmedBookingReply("sim", "Você quer conhecer os pacotes?")).toBe(false);
    expect(
      isConfirmedBookingReply(
        "sim, mas preciso confirmar com minha família",
        "Evento em 10/12/2026, pacote Ouro para 60 pessoas, valor R$ 5.000. Você confirma?",
      ),
    ).toBe(false);
  });
});
