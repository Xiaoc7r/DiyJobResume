import { test, expect } from "@playwright/test";

test("color popovers allow HEX editing, canvas sampling and explicit cancellation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await page.getByRole("button", { name: "主题颜色", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "主题调色板", exact: true }),
    hex = panel.getByLabel("主题 HEX", { exact: true });
  await hex.fill("#123");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#112233");
  await hex.fill("#xyz");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#112233");
  await panel.getByRole("button", { name: "画布取色", exact: true }).click();
  await expect(panel).toHaveClass(/is-picking/);
  await expect(
    panel.getByRole("button", { name: "取消取色", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "取消取色", exact: true }).click();
  await expect(panel).not.toHaveClass(/is-picking/);
  await expect(hex).toHaveValue("#112233");
  await panel.getByRole("button", { name: "画布取色", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveClass(/is-picking/);
  await panel.getByRole("button", { name: "画布取色", exact: true }).click();
  const paper = await page
    .locator(".paper-workspace .resume-paper")
    .first()
    .boundingBox();
  await page.mouse.click(paper!.x + 12, paper!.y + 12);
  await expect(hex).toHaveValue("#ffffff", { timeout: 30000 });
  await expect(panel).not.toHaveClass(/is-picking/);
  await panel
    .getByRole("button", { name: "恢复主题默认色", exact: true })
    .click();
  await expect(hex).toHaveValue("#0756a5");
  await page.screenshot({ path: "../refinement-colors.png" });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("uncached entry fits the paper at browser-equivalent viewport scales", async ({
  page,
}) => {
  for (const width of [1280, 1800, 2200, 768, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect
      .poll(async () =>
        page.locator(".paper-workspace").evaluate((area) => {
          const r = area.getBoundingClientRect(),
            p = area.querySelector(".page-frame")!.getBoundingClientRect();
          return (
            p.left >= r.left &&
            p.right <= r.right &&
            area.scrollWidth <= area.clientWidth
          );
        }),
      )
      .toBe(true);
    const wide = await page
      .locator(".zoom-control input")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().width /
          el.parentElement!.getBoundingClientRect().width,
      );
    expect(wide).toBeGreaterThan(0.6);
    if (width === 1800)
      await page.screenshot({ path: "../refinement-first-visit.png" });
  }
  await page.getByLabel("预览缩放", { exact: true }).fill("150");
  await page.reload();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("150");
});

test("free mode loads with a centered animated state and the grid enabled", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/FreeStudio-*.js", async (route) => {
    await waiting;
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  try {
    const loading = page
      .getByRole("status", { name: "加载自由模式", exact: true })
      .first();
    await expect(loading).toBeVisible();
    await expect(loading.locator(".loading-wordmark")).toHaveText(
      "DiyJobResume",
    );
    await page.screenshot({ path: "../refinement-loading.png" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(loading.locator(".loading-wordmark")).toHaveCSS(
      "animation-name",
      "none",
    );
  } finally {
    release();
  }
  await expect(page.locator(".free-canvas-host")).toBeVisible();
  await expect(page.getByLabel("网格", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("status", { name: "加载自由模式", exact: true }),
  ).toHaveCount(0);
});
