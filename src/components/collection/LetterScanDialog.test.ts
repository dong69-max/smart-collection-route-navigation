import { describe, expect, it } from "vitest";
import { parseLetterText } from "@/components/collection/LetterScanDialog";

// @kliv-spec-derived — 用户给的两种真实信件格式必须正确解析
describe("信件文字解析", () => {
  it("住家信：TO: 名字 + 地址", () => {
    const text = [
      "TO: MOHD HAFIZ BIN MUHAMAD",
      "22, Jalan Bukit Kempas 5,",
      "Taman Bukit Kempas,",
      "81200 Johor Bahru, Johor",
    ].join("\n");
    const r = parseLetterText(text);
    expect(r).not.toBeNull();
    expect(r!.isCompany).toBe(false);
    expect(r!.name.toUpperCase()).toContain("MOHD HAFIZ BIN MUHAMAD");
    expect(r!.address).toContain("22, Jalan Bukit Kempas 5");
    expect(r!.address).toContain("81200 Johor Bahru, Johor");
  });

  it("公司信：公司名 + 地址 + Remark: 客户名（名字取公司名）", () => {
    const text = [
      "TEGAS SECURITY SERVICES SDN BHD",
      "18-01,JALAN TITIWANGSA 3/2,TAMAN TAMPOI INDAH,",
      "81200 JOHOR BAHRU,JOHOR DARUL TA`ZIM",
      "Remark: MUHAMMAD RIDZUAN BIN ABDULLAH",
    ].join("\n");
    const r = parseLetterText(text);
    expect(r).not.toBeNull();
    expect(r!.isCompany).toBe(true);
    expect(r!.name.toUpperCase()).toContain("TEGAS SECURITY SERVICES SDN BHD");
    expect(r!.address.toUpperCase()).toContain("JALAN TITIWANGSA 3/2");
    expect(r!.address.toUpperCase()).toContain("81200 JOHOR BAHRU");
  });

  it("OCR 误读（` 与多余空格）也能解析", () => {
    const text = [
      "TEGAS SECURITY SERVICES SDN BHD",
      "18-01 , JALAN TITIWANGSA 3/2 , TAMAN TAMPOI INDAH , 81200 JOHOR BAHRU",
      "Remark : MUHAMMAD RIDZUAN BIN ABDULLAH",
    ].join("\n");
    const r = parseLetterText(text);
    expect(r!.isCompany).toBe(true);
    expect(r!.name).toContain("TEGAS");
  });

  it("小写 to: 也认得出", () => {
    const r = parseLetterText("to: Ali Bin Abu\n12, Jalan Molek 3, Taman Molek");
    expect(r!.isCompany).toBe(false);
    expect(r!.name.toLowerCase()).toBe("ali bin abu");
    expect(r!.address).toContain("Jalan Molek 3");
  });

  it("没有标记词时退回：第一行当名字其余当地址", () => {
    const r = parseLetterText("Ahmad Bin Saleh\n5, Jalan Teratai, Taman Sri Lambak");
    expect(r!.name).toContain("Ahmad");
    expect(r!.address).toContain("Jalan Teratai");
  });

  it("空文字返回 null", () => {
    expect(parseLetterText("")).toBeNull();
    expect(parseLetterText("\n \n")).toBeNull();
  });
});
