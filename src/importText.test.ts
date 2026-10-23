import { describe, expect, it } from "vitest";
import {
  contentToLines,
  layoutSteps,
  looksLikeMarkdown,
  looksLikeResumeBlock,
  textToLines,
} from "./importText";

const RAW = `李景阳
电话：18319206783   ｜   邮箱：1406083391@qq.com
现居：东莞（可就近广州、深圳） ｜语言：粤语（母语）/ 普通话（母语）｜   本科
【个人总结】
· 毕业于东莞理工学院，计算机科学与技术专业，本科学历。
· 有信息化系统部署与运维实战经验：基于 Docker / Linux 完成服务部署。
【项目经历】
► 企业级 AI Agent 平台（OpenClaw + DeepSeek）   项目负责人   2026.05 – 2026.09
· 系统部署与运维：独立完成 Node.js 环境搭建、OpenClaw 框架配置与 Linux 部署。
· 故障排查与对接：解决企业微信 API 权限分层、VPN 网络限制。
【教育背景】
东莞理工学院   计算机科学与技术   本科   2022.09 – 2026.06
· 荣誉：东莞理工学院奖学金三等奖（2023.12）
【证书 / 其他】
· CCT 全国计算机二级（Python 程序设计）
· 机动车驾驶证`;

describe("pasted resume text", () => {
  it("turns the first lines into name and contact", () => {
    const lines = textToLines(RAW);
    expect(lines[0]).toMatchObject({ kind: "name", text: "李景阳" });
    expect(lines[1].kind).toBe("text");
    // 两行联系方式会合并成一行，避免页眉挤成两条
    expect(lines[1].text).toContain("18319206783");
    expect(lines[1].text).toContain("现居");
    expect(lines[2]).toMatchObject({ kind: "section", text: "个人总结" });
  });

  it("recognizes 【section】 headings and bullet markers", () => {
    const lines = textToLines(RAW);
    const sections = lines
      .filter((line) => line.kind === "section")
      .map((line) => line.text);
    expect(sections).toEqual(["个人总结", "项目经历", "教育背景", "证书 / 其他"]);
    const bullets = lines.filter((line) => line.kind === "bullet");
    expect(bullets.length).toBe(7);
    expect(bullets[0].text).toContain("毕业于东莞理工学院");
  });

  it("keeps company, role and dates on one entry line", () => {
    const lines = textToLines(RAW);
    const entries = lines.filter((line) => line.kind === "entry");
    expect(entries[0]).toEqual({
      id: expect.any(String),
      kind: "entry",
      text: "企业级 AI Agent 平台（OpenClaw + DeepSeek） | 项目负责人 | 2026.05 – 2026.09",
    });
    // 四段（学校 / 专业 / 学历 / 时间）合并成三列，避免排版挤成四栏
    expect(entries[1].text).toBe(
      "东莞理工学院 | 计算机科学与技术 本科 | 2022.09 – 2026.06",
    );
  });

  it("does not lose any wording", () => {
    const lines = textToLines(RAW);
    const text = lines.map((line) => line.text).join("\n");
    expect(text).toContain("1406083391@qq.com");
    expect(text).toContain("机动车驾驶证");
    expect(text).toContain("2023.12");
    expect(text).not.toContain("►");
    expect(text).not.toContain("【");
  });

  it("tells a pasted resume apart from a short instruction", () => {
    expect(looksLikeResumeBlock(RAW)).toBe(true);
    expect(looksLikeResumeBlock("把行距调大一点")).toBe(false);
    expect(
      looksLikeResumeBlock("李景阳\n电话：123\n· 一条\n· 两条\n· 三条"),
    ).toBe(true);
  });

  it("tells a pasted resume apart from a short instruction", () => {
    expect(looksLikeResumeBlock(RAW)).toBe(true);
    expect(looksLikeResumeBlock("把行距调大一点")).toBe(false);
    expect(
      looksLikeResumeBlock(
        "李景阳\n电话：123\n· 一条\n· 两条\n· 三条",
      ),
    ).toBe(true);
  });

  it("splits section markers written inline", () => {
    const lines = textToLines("李景阳\n【项目经历】某项目\n教育背景：东莞理工学院");
    expect(lines.map((line) => [line.kind, line.text])).toEqual([
      ["name", "李景阳"],
      ["section", "项目经历"],
      ["text", "某项目"],
      ["section", "教育背景"],
      ["text", "东莞理工学院"],
    ]);
  });

  it("glues a bullet that was hard-wrapped while copying", () => {
    const lines = textToLines(RAW.replace(
      "· 有信息化系统部署与运维实战经验：基于 Docker / Linux 完成服务部署。",
      "· 有信息化系统部署与运维实战经验：基于 Docker / Linux 完成服务部署，\n并且熟悉日志与进程守护。",
    ));
    const merged = lines.find((line) => line.text.includes("日志与进程守护"));
    expect(merged?.kind).toBe("bullet");
    expect(lines.some((line) => line.text === "并且熟悉日志与进程守护。")).toBe(
      false,
    );
  });

  it("removes duplicated contact lines and keeps one", () => {
    const lines = textToLines(
      "李景阳\n电话：18319206783\n电话：18319206783\n【个人总结】\n· 一条",
    );
    expect(
      lines.filter((line) => line.text.includes("18319206783")),
    ).toHaveLength(1);
  });

  it("promotes a buried name to the top", () => {
    const lines = textToLines(
      "电话：138 0000 0000 ｜ 邮箱：a@b.com\n李景阳\n【个人总结】\n· 一条",
    );
    expect(lines[0]).toMatchObject({ kind: "name", text: "李景阳" });
    expect(lines[1].text).toContain("138 0000 0000");
  });

  it("drops sections that have no content", () => {
    const lines = textToLines("李景阳\n【其他】\n【证书】\n· 驾驶证");
    expect(lines.map((line) => line.text)).not.toContain("其他");
    expect(lines.some((line) => line.kind === "section" && line.text === "证书")).toBe(
      true,
    );
  });

  it("turns numbered rows into an ordered list", () => {
    const lines = textToLines("李景阳\n【工作经历】\n1. 第一件事\n2、第二件事");
    const ordered = lines.filter((line) => line.kind === "ordered");
    expect(ordered.map((line) => line.order)).toEqual([1, 2]);
  });

  it("merges consecutive contact lines into one", () => {
    const lines = textToLines(
      "李景阳\n电话：138 ｜ 邮箱：a@b.com\n现居：东莞 ｜ 本科\n【个人总结】\n· 一条",
    );
    const contacts = lines.filter(
      (line) => line.kind === "text" && line.text.includes("138"),
    );
    expect(contacts).toHaveLength(1);
    expect(contacts[0].text).toContain("现居");
  });

  it("attaches a date-only line to the entry above it", () => {
    const lines = textToLines(
      "李景阳\n【工作经历】\n► 某公司   工程师\n2024.01 – 2024.12\n· 做了点事",
    );
    const entry = lines.find((line) => line.kind === "entry");
    expect(entry?.text).toBe("某公司 | 工程师 | 2024.01 – 2024.12");
  });

  it("recognizes an entry written as plain body text", () => {
    const lines = textToLines(
      "李景阳\n【工作经历】\n某公司   工程师   2023.03 – 2024.01\n· 做了点事",
    );
    expect(lines.find((line) => line.kind === "entry")?.text).toBe(
      "某公司 | 工程师 | 2023.03 – 2024.01",
    );
  });

  it("reports layout stages and ends with the final lines", () => {
    const stages = Array.from(layoutSteps(RAW));
    expect(stages).toHaveLength(6);
    expect(stages.map((stage) => stage.label).join(" ")).toContain("重新排格式");
    expect(stages[0].label).toContain("清洗文字");
    const brief = (list: { kind: string; text: string }[]) =>
      list.map((line) => [line.kind, line.text]);
    expect(brief(stages.at(-1)!.lines)).toEqual(brief(textToLines(RAW)));
  });

  it("accepts markdown output as well", () => {
    const markdown = "# 张三\n138 | a@b.com\n## 教育背景\n### 某大学 | 本科 | 2020 – 2024\n- 课程";
    expect(looksLikeMarkdown(markdown)).toBe(true);
    const lines = contentToLines(markdown);
    expect(lines[0]).toMatchObject({ kind: "name", text: "张三" });
    expect(lines[2]).toMatchObject({ kind: "section", text: "教育背景" });
    expect(lines[3].kind).toBe("entry");
    expect(lines[4].kind).toBe("bullet");
  });

  it("treats plain text without headings as body lines", () => {
    expect(looksLikeMarkdown("李景阳\n电话：123")).toBe(false);
    const lines = contentToLines("李景阳\n电话：123");
    expect(lines.map((line) => line.kind)).toEqual(["name", "text"]);
  });

  it("still uses the paste rules when the text has - bullets but no headings", () => {
    const text = "李景阳\n【项目经历】\n- 做了点事\n- 又做了一件事";
    expect(looksLikeMarkdown(text)).toBe(false);
    expect(contentToLines(text).map((line) => line.kind)).toEqual([
      "name",
      "section",
      "bullet",
      "bullet",
    ]);
  });
});
