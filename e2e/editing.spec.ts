import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("typing and deleting across rich inline nodes never crashes the editors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const md = page.getByLabel("Markdown 简历内容");
  await md.fill("# 炒肉多\n\n前缀 空格 **重点**字\n\n## 教育背景");
  await md.press("Control+Home");
  await md.press("ArrowDown");
  await md.press("ArrowDown");
  for (let i = 0; i < 10; i++) await md.press("ArrowRight");
  await md.press("Backspace");
  await md.press("Delete");
  for (const value of [
    "#   炒肉多  ",
    "# ",
    "",
    "## 教育背景\n\n- A **粗体**尾字",
    "   ",
    "# 新简历",
  ]) {
    await md.fill(value);
    await md.press("End");
    await md.press("Backspace");
    await expect(page.locator(".studio")).toBeVisible();
  }
  await md.fill("# 炒肉多\n\n前缀 空格 **重点**字");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  const row = page.locator("[data-simple]").last();
  await row.click();
  await row.press("End");
  await row.press("Backspace");
  await row.press("Delete");
  await expect(page.locator(".studio")).toBeVisible();
  expect(errors).toEqual([]);
});

test("deleting a selection spanning rows leaves React row containers intact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 简历内容")
    .fill("# 示例\n第一行\n第二行\n第三行");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.locator("[data-simple]").nth(1).focus();
  await page.evaluate(() => {
    const rows = document.querySelectorAll("[data-simple]"),
      range = document.createRange(),
      a = rows[1].querySelector(".ink")!.firstChild!,
      b = rows[3].querySelector(".ink")!.firstChild!;
    range.setStart(a, 1);
    range.setEnd(b, 1);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
  });
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-simple]")).toHaveCount(2);
  await expect(page.locator("[data-simple]").last()).toHaveText("第三行");
  await expect(page.locator(".studio")).toBeVisible();
  expect(errors).toEqual([]);
});

test("spaces stay at the caret in a heading and keep room for a free icon", async ({
  page,
}) => {
  const title = page.locator("[data-simple]").first();
  await title.click();
  await title.press("Home");
  await title.press("ArrowRight");
  await page.keyboard.insertText("  ");
  await expect(title).toHaveText("炒  肉多");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const md = page.getByLabel("Markdown 简历内容");
  expect(await md.inputValue()).toMatch(/^# 炒  肉多/);
  await md.fill("#   炒肉多\n   图标留白");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper .row-name")).toHaveText(
    "  炒肉多",
  );
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  expect(await md.inputValue()).toContain("   图标留白");
});

test("zoom persists in both directions and resetting the layout preserves edits", async ({
  page,
}) => {
  await page.getByLabel("预览缩放", { exact: true }).fill("110");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("110");
  await page.getByRole("button", { name: "放大预览", exact: true }).click();
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("120");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("120");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  await page.locator(".free-source-paper .row-name").fill("保留我的文字");
  await page.getByRole("button", { name: "恢复原排版", exact: true }).click();
  await expect(page.locator(".free-source-paper .row-name")).toHaveText(
    "保留我的文字",
  );
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.locator(".free-layer-background rect")).toHaveCount(0);
  await expect(page.locator(".free-source-banner")).toHaveCount(0);
  await expect(
    page.getByRole("separator", { name: "调整右侧面板宽度" }),
  ).toHaveCount(0);
  const ratio = await page
    .locator(".mini-paper")
    .first()
    .evaluate((el) => el.clientWidth / el.clientHeight);
  expect(ratio).toBeCloseTo(210 / 297, 2);
});

test("default sample is one A4 with the supplied school and anchored entry icons", async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole("link", {
      name: "DiyJobResume 让简历回归本源",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("简历名称")).toHaveValue("炒肉多示例简历");
  await expect(page.locator(".resume-paper")).toHaveCount(1);
  await expect(page.locator(".resume-paper .floating-picture")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("desktop.png") });
  const previewStyle = await page.addStyleTag({
    content:
      ".app-header{visibility:hidden!important;}.studio .resume-paper{position:fixed!important;left:0!important;top:0!important;transform:none!important;z-index:9999!important;}",
  });
  await page
    .locator(".resume-paper")
    .screenshot({ path: testInfo.outputPath("sample.png") });
  await previewStyle.evaluate((el) => el.remove());
  const boxes = await page.locator(".resume-paper").evaluate((paper) => {
    const p = paper.getBoundingClientRect(),
      z = p.width / 794;
    return [...paper.querySelectorAll(".floating-picture")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: el.getAttribute("aria-label"),
        x: (r.x - p.x) / z,
        y: (r.y - p.y) / z,
        w: r.width / z,
        h: r.height / z,
      };
    });
  });
  const aligned = await page
    .locator(".floating-picture[data-anchor]")
    .evaluateAll((elements) =>
      elements.map((el) => {
        const paper = el.closest(".resume-paper")!,
          scale = paper.getBoundingClientRect().width / 794,
          row = paper.querySelector(
            `[data-line="${(el as HTMLElement).dataset.anchor}"]`,
          )!;
        return (
          (el.getBoundingClientRect().top - row.getBoundingClientRect().top) /
          scale
        );
      }),
    );
  expect(aligned).toHaveLength(3);
  for (const delta of aligned) expect(Math.abs(delta - 3)).toBeLessThan(0.6);
  expect(boxes[0].x).toBeCloseTo(40, 0);
  expect(boxes[0].y).toBeCloseTo(20, 0);
  for (const b of boxes.slice(1)) {
    expect(b.w).toBeCloseTo(16, 0);
    expect(b.h).toBeCloseTo(16, 0);
  }
});
