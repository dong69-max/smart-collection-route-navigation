import { describe, expect, it } from "vitest";
import { buildCardRows } from "./shareCard";

// @kliv-spec-derived — 用户：微信分享只收到图片、文字被丢掉 → 文字必须完整出现在摘要卡上
describe("分享摘要卡", () => {
  it("卡上有标题、分享文字的每一行和落款", () => {
    const rows = buildCardRows("客户：AHMAD\n结果：已收款\n收款：RM 208.00");
    const texts = rows.map((r) => r.text);
    expect(texts[0]).toBe("📋 收账记录");
    expect(texts).toContain("客户：AHMAD");
    expect(texts).toContain("结果：已收款");
    expect(texts).toContain("收款：RM 208.00");
    expect(texts[texts.length - 1]).toBe("JOM TUNAI KOMUNITI");
  });

  it("分享文字里的空行不会出现在卡上", () => {
    const rows = buildCardRows("客户：AHMAD\n\n\n结果：未收款\n");
    expect(rows.filter((r) => r.text.trim() === "")).toHaveLength(0);
    expect(rows).toHaveLength(4); // 标题 + 两行内容 + 落款
  });
});
