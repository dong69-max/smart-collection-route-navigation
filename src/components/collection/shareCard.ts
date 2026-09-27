// 微信分享的坑：分享内容里带图片时，微信只接收图片、丢掉文字（WhatsApp 正常）。
// 兜底：把文字摘要渲染成一张「摘要卡」图片，放在现场照片最前面一起分享。

export interface CardRow {
  text: string;
  kind: "title" | "body" | "brand";
}

/** 从分享文字生成卡片上的行：标题 + 全部非空行 + 落款 */
export function buildCardRows(text: string): CardRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return [
    { text: "📋 收账记录", kind: "title" },
    ...lines.map((l): CardRow => ({ text: l, kind: "body" })),
    { text: "JOM TUNAI KOMUNITI", kind: "brand" },
  ];
}

const font = (size: number, weight = "400") =>
  `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

/** 把分享文字渲染成一张摘要卡图片（JPEG），供随照片一起分享 */
export async function buildSummaryCardFile(text: string): Promise<File> {
  const rows = buildCardRows(text);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  const W = 750;
  const PAD = 48;
  const BODY_SIZE = 30;

  // 逐字换行（地址很长时也能排进卡里）
  const wrap = (s: string, f: string, maxW: number): string[] => {
    ctx.font = f;
    const out: string[] = [];
    let cur = "";
    for (const ch of s) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out.length > 0 ? out : [""];
  };

  type Line = { text: string; kind: CardRow["kind"] };
  const lines: Line[] = [];
  for (const r of rows) {
    if (r.kind === "body") {
      for (const seg of wrap(r.text, font(BODY_SIZE, "500"), W - PAD * 2)) {
        lines.push({ text: seg, kind: "body" });
      }
    } else {
      lines.push(r);
    }
  }

  const lineH = (kind: CardRow["kind"]) => (kind === "title" ? 68 : kind === "brand" ? 42 : 46);
  const H = PAD + 10 + lines.reduce((s, l) => s + lineH(l.kind), 0) + PAD;

  canvas.width = W;
  canvas.height = H;
  // 设置宽高会重置画布状态，背景与文字都要在设置之后画
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(0, 0, W, 10);

  let y = PAD + 10;
  ctx.textBaseline = "top";
  for (const l of lines) {
    if (l.kind === "title") {
      y += 8;
      ctx.font = font(42, "700");
      ctx.fillStyle = "#0f172a";
    } else if (l.kind === "brand") {
      y += 12;
      ctx.font = font(22);
      ctx.fillStyle = "#94a3b8";
    } else {
      ctx.font = font(BODY_SIZE, "500");
      ctx.fillStyle = "#1e293b";
    }
    ctx.fillText(l.text, PAD, y);
    y += lineH(l.kind);
  }

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error("summary card render failed");
  return new File([blob], "收账记录摘要.jpg", { type: "image/jpeg" });
}
