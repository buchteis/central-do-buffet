import { describe, expect, it } from "vitest";
import { markDashboardSeen, unseenDashboardAlerts } from "./dashboard-alerts";

describe("avisos do Dashboard", () => {
  it("aparece na primeira vez", () => {
    expect(unseenDashboardAlerts([{ key: "pay", count: 1 }], {})).toHaveLength(1);
  });

  it("não aparece de novo depois de lido, sem itens novos", () => {
    const seen = markDashboardSeen([{ key: "pay", count: 1 }], {});
    expect(unseenDashboardAlerts([{ key: "pay", count: 1 }], seen)).toHaveLength(0);
  });

  it("volta a aparecer quando chega um item novo", () => {
    const seen = markDashboardSeen([{ key: "quotes", count: 2 }], {});
    expect(unseenDashboardAlerts([{ key: "quotes", count: 3 }], seen)).toHaveLength(1);
  });
});
