import { describe, expect, it } from "vitest";
import { createTranslator, resolveLocale } from "./i18n";

describe("i18n", () => {
  it("resolves system language to a supported locale", () => {
    expect(resolveLocale("system", "zh-Hans-CN")).toBe("zh-CN");
    expect(resolveLocale("system", "zh-CN")).toBe("zh-CN");
    expect(resolveLocale("system", "en-US")).toBe("en");
    expect(resolveLocale("system", undefined)).toBe("en");
  });

  it("honors explicit language settings", () => {
    expect(resolveLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(resolveLocale("en", "zh-CN")).toBe("en");
  });

  it("translates key UI labels in English and Simplified Chinese", () => {
    const en = createTranslator("en");
    const zh = createTranslator("zh-CN");

    expect(en("nav.today")).toBe("Today");
    expect(en("settings.language")).toBe("Language");
    expect(en("sources.scanCompleted")).toBe("Scan complete");
    expect(zh("nav.today")).toBe("今日");
    expect(zh("settings.language")).toBe("语言");
    expect(zh("sources.scanCompleted")).toBe("扫描完成");
    expect(zh("status.needs_review")).toBe("待复盘");
  });
});
