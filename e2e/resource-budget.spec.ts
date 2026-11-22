import { test, expect } from "@playwright/test";

test("unchanged custom artwork is reused through preview and selection updates", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await page.locator(".free-art-name").first().click();
  await page.getByLabel("元素 X 位置", { exact: true }).fill("44");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(
    page.locator(".free-layer-background svg rect").first(),
  ).toBeAttached();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.evaluate(() => {
    (window as any).vectorKeyBuilds = 0;
    const original = JSON.stringify;
    JSON.stringify = ((value: any, ...args: any[]) => {
      if (
        Array.isArray(value) &&
        value.length === 4 &&
        value[0] === 794 &&
        Array.isArray(value[3])
      )
        (window as any).vectorKeyBuilds++;
      return (original as any)(value, ...args);
    }) as typeof JSON.stringify;
  });
  for (const zoom of ["110", "120", "100"]) {
    await page.getByLabel("预览缩放", { exact: true }).fill(zoom);
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
  }
  expect(await page.evaluate(() => (window as any).vectorKeyBuilds)).toBe(0);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await page.locator(".free-art-name").first().click();
  await expect(page.getByLabel("元素 X 位置", { exact: true })).toHaveValue(
    "44",
  );
});

test("Markdown typing retains a single gutter resize subscription and correct line numbers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.ResizeObserver;
    (window as any).gutterSubscriptions = 0;
    window.ResizeObserver = class extends Original {
      observe(target: Element, options?: ResizeObserverOptions) {
        if (
          target instanceof HTMLTextAreaElement &&
          target.getAttribute("aria-label") === "Markdown 简历内容"
        )
          (window as any).gutterSubscriptions++;
        super.observe(target, options);
      }
    };
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Markdown 简历内容",
    exact: true,
  });
  await expect(page.locator(".markdown-numbers span").first()).toHaveText("1");
  const initial = await page.evaluate(
    () => (window as any).gutterSubscriptions,
  );
  for (let i = 0; i < 6; i++)
    await editor.fill(`# 姓名\n\n## 教育背景\n学校 ${i}`);
  await expect(page.locator(".markdown-numbers span")).toHaveCount(4);
  expect(await page.evaluate(() => (window as any).gutterSubscriptions)).toBe(
    initial,
  );
  await editor.fill("# 姓名\n\n## 教育背景\n" + "学校经历 ".repeat(150));
  await expect
    .poll(() =>
      page
        .locator(".markdown-numbers span")
        .last()
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeGreaterThan(24);
  await editor.fill("# 姓名\n## 教育背景");
  await expect(page.locator(".markdown-numbers span")).toHaveCount(2);
});
