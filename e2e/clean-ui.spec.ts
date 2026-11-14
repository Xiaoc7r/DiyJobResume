import { test, expect } from "@playwright/test";

test("header stays fixed while the editor resizes, toolbar ordering and typography settings", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "我的简历", exact: true });
  const before = await toggle.boundingBox();
  const handle = page.getByRole("separator", {
    name: "调整编辑区宽度",
    exact: true,
  });
  const initialWidth = await page
    .locator(".editor-panel")
    .evaluate((el) => el.getBoundingClientRect().width);
  await handle.focus();
  await handle.press("ArrowRight");
  await handle.press("ArrowRight");
  expect(
    await page
      .locator(".editor-panel")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(initialWidth);
  expect((await toggle.boundingBox())!.x).toBeCloseTo(before!.x, 1);
  await expect(page.locator(".editor-hint")).toHaveCount(0);
  expect(
    await page
      .locator(".format-toolbar > button")
      .evaluateAll((els) =>
        els.slice(0, 5).map((el) => el.getAttribute("aria-label")),
      ),
  ).toEqual(["撤销", "重做", "上传证件照", "上传校徽", "自定义 CSS"]);
  await page.getByRole("button", { name: "间距与字号", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "间距与字号", exact: true });
  await expect(dialog.locator(".page-settings > *")).toHaveCount(6);
  const rows = await dialog
    .locator(".page-settings > *")
    .evaluateAll((els) => [
      ...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))),
    ]);
  expect(rows).toHaveLength(3);
  await page.screenshot({ path: "../clean-typography.png" });
  await dialog.getByLabel("简历字体", { exact: true }).selectOption("serif");
  await expect(page.locator(".resume-paper").first()).toHaveCSS(
    "font-family",
    /Noto Serif SC/,
  );
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator(".resume-paper").first()).toHaveCSS(
    "font-family",
    /Noto Sans SC/,
  );
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(page.locator(".resume-paper").first()).toHaveCSS(
    "font-family",
    /Noto Serif SC/,
  );
  await page.screenshot({ path: "../clean-toolbar.png" });
});

test("whiteboard creates a clean document while preserving the current resume", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page.getByLabel("简历名称").inputValue();
  await page.getByRole("button", { name: "使用白板模板", exact: true }).click();
  await expect(page.getByLabel("简历名称")).toHaveValue("空白简历");
  await expect(page.locator(".resume-paper")).toHaveCount(1);
  await expect(page.locator(".floating-picture")).toHaveCount(0);
  await expect(page.locator(".resume-paper")).toHaveText("");
  await expect(page.locator(".mini-blank")).toHaveText("");
  const row = page.locator("[data-simple]").first();
  await row.fill("从白板写起");
  await expect(page.locator(".resume-paper")).toContainText("从白板写起");
  await page.getByRole("button", { name: "我的简历", exact: true }).click();
  await page.getByRole("menuitemradio", { name: original }).click();
  await expect(page.getByLabel("简历名称")).toHaveValue(original);
  await expect(page.locator(".resume-paper")).toContainText("炒肉多");
});

test("free mode has no footer and all page and export actions remain on the right", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-canvas-host")).toBeVisible();
  await expect(
    page.locator(".free-footer,.free-zoom,.free-empty-selection"),
  ).toHaveCount(0);
  await expect(page.getByLabel("自由纸张颜色", { exact: true })).toHaveCount(0);
  const right = page.locator(".free-right");
  await expect(
    right.getByRole("button", { name: /^可编辑备份/ }),
  ).toBeVisible();
  await expect(right.getByRole("button", { name: /^本页 PNG/ })).toBeVisible();
  await right.getByRole("button", { name: "新增自由页", exact: true }).click();
  await expect(right.getByLabel("当前自由页")).toHaveValue("1");
  await right.getByLabel("当前自由页").selectOption("0");
  await expect(page.locator(".free-page-label")).toContainText("第 1 页");
  await page.screenshot({ path: "../clean-free-sidebar.png" });
});
