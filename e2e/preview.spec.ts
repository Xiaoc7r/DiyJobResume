import { test, expect } from "@playwright/test";

test("large previews remain scrollable and free mode shares zoom with an unobstructed detail view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const zoom = () => page.getByLabel("预览缩放", { exact: true });
  await zoom().fill("180");
  const checkEdges = async (scrollSelector: string, paperSelector: string) => {
    const result = await page
      .locator(scrollSelector)
      .evaluate((area, selector) => {
        const paper = area.querySelector(selector)!;
        area.scrollLeft = 0;
        const left =
          paper.getBoundingClientRect().left -
          area.getBoundingClientRect().left;
        area.scrollLeft = area.scrollWidth;
        const right =
          area.getBoundingClientRect().right -
          paper.getBoundingClientRect().right;
        return { left, right, overflow: area.scrollWidth > area.clientWidth };
      }, paperSelector);
    expect(result.overflow).toBe(true);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.right).toBeGreaterThanOrEqual(0);
  };
  await checkEdges(".paper-workspace", ".page-frame");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(zoom()).toHaveValue("180");
  await checkEdges(".free-canvas-scroll", ".free-page-frame");
  await zoom().fill("100");
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await page.locator(".free-object-name").first().click();
  await expect(page.locator(".free-detail-viewport svg image")).toHaveCount(3);
  await expect(
    page.locator(
      ".free-detail-viewport canvas, .free-detail-viewport .moveable-control-box",
    ),
  ).toHaveCount(0);
  const before = await page
    .locator(".free-detail-viewport > div")
    .getAttribute("style");
  // Keyboard movement uses the same live transform path as dragging.
  await page.locator(".free-object-name").first().press("ArrowRight");
  await expect
    .poll(() =>
      page.locator(".free-detail-viewport > div").getAttribute("style"),
    )
    .not.toBe(before);
  await page.screenshot({ path: "../preview-desktop.png" });
  await zoom().fill("135");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(zoom()).toHaveValue("135");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(zoom()).toHaveValue("135");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(zoom()).toHaveValue("135");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(zoom()).toBeVisible();
  await checkEdges(".free-canvas-scroll", ".free-page-frame");
  await page.screenshot({ path: "../preview-tablet.png" });
  expect(errors).toEqual([]);
});
