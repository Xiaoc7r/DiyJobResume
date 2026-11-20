import { test, expect } from "@playwright/test";

test("four-step help loops through demonstrations without changing the résumé or view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page.getByLabel("预览缩放", { exact: true }).fill("120");
  await page.clock.runFor(500);
  const storedState = () =>
    page.evaluate(async () =>
      Object.fromEntries(
        await Promise.all(
          Object.keys(localStorage).map(async (key) => [
            key,
            Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(localStorage.getItem(key)!),
                ),
              ),
            )
              .map((x) => x.toString(16).padStart(2, "0"))
              .join(""),
          ]),
        ),
      ),
    );
  const before = await storedState();
  const help = page.getByRole("button", { name: "使用帮助", exact: true });
  await expect(help).toHaveClass(/is-unseen/);
  await help.click();
  const tour = page.getByRole("dialog", { name: "四步使用指引" });
  await expect(tour).toHaveAttribute("data-step", "1");
  await expect(tour.locator(".tour-simple")).toBeVisible();
  await expect(tour.locator(".tour-tool-mark")).toHaveCount(3);
  await page.clock.runFor(1450);
  await expect(tour.locator(".tour-md")).toBeVisible();
  await page.clock.runFor(1400);
  await expect(tour.locator(".tour-simple")).toBeVisible();
  await tour.locator(".tour-heading > span").click();
  await expect(tour).toHaveAttribute("data-step", "2");
  await expect(tour.locator(".tour-tools-grid").first()).toBeVisible();
  await page.clock.runFor(1450);
  await expect(tour.locator(".tour-object")).toHaveCount(6);
  await expect(tour.locator(".tour-number-change")).toHaveText("1360");
  // Clicking the copy, paper, or surrounding scene advances just like the button.
  await tour.locator("h2").click();
  await expect(tour).toHaveAttribute("data-step", "3");
  await expect(tour.locator(".tour-template.active")).toContainText(
    "炒肉多经典",
  );
  await page.clock.runFor(1450);
  await expect(tour.locator(".tour-template.active")).toContainText("黑线");
  await tour.getByRole("button", { name: "下一步" }).click();
  await expect(tour).toHaveAttribute("data-step", "4");
  await page.clock.runFor(1450);
  await expect(tour.locator(".tour-art-1")).toHaveCount(4);
  await page.clock.runFor(2800);
  await expect(tour.locator(".tour-demo-save")).toContainText("已保存");
  await tour.getByRole("button", { name: "开始制作" }).click();
  await expect(tour).toHaveCount(0);
  await expect(help).toBeFocused();
  await expect(help).not.toHaveClass(/is-unseen/);
  await expect(
    page.getByRole("tab", { name: "Markdown", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("120");
  expect(await storedState()).toEqual(before);
  await page.reload();
  await expect(help).not.toHaveClass(/is-unseen/);
  expect(errors).toEqual([]);
});

test("help remains accessible on a small screen and restores free-canvas focus on escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const help = page.getByRole("button", { name: "使用帮助", exact: true });
  await help.click();
  const tour = page.getByRole("dialog", { name: "四步使用指引" });
  const close = tour.getByRole("button", { name: "关闭指引" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tour.getByRole("button", { name: "下一步" })).toBeFocused();
  for (let step = 1; step <= 4; step++) {
    await expect(tour).toHaveAttribute("data-step", String(step));
    expect(await tour.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const box = await tour.locator(".tour-navigation").boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    if (step < 4) await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await expect(page.locator("#root")).not.toHaveAttribute("inert");
  await expect(help).toBeFocused();
  await page.setViewportSize({ width: 1800, height: 1200 });
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
});
