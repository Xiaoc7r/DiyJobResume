import { test, expect } from "@playwright/test";

test("selected link colors override a red theme, survive Markdown, undo and free printing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("button", { name: "使用红序 · 系统架构模板", exact: true })
    .click();
  const link = page.locator(".simple-editor .simple-input a").first();
  await link.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    (el.closest(".simple-editor") as HTMLElement).focus();
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await page.getByRole("button", { name: "文字颜色", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "文字调色板", exact: true }),
    hex = panel.getByLabel("文字 HEX", { exact: true });
  await hex.fill("#171717");
  await hex.fill("#0000ff");
  await expect(hex).toHaveValue("#0000ff");
  await panel.getByRole("button", { name: "关闭调色板" }).click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const editor = page.getByLabel("Markdown 简历内容");
  expect(await editor.inputValue()).toContain(
    '<span style="color:#0000ff">github.com/Xiaoc7r</span>',
  );
  expect(await editor.inputValue()).toContain("https://github.com/Xiaoc7r");
  const value = await editor.inputValue(),
    start = value.indexOf("github.com/Xiaoc7r");
  await editor.focus();
  await editor.evaluate(
    (el: any, [a, b]) => el.setSelectionRange(a, b),
    [start, start + "github.com/Xiaoc7r".length],
  );
  await page.getByRole("button", { name: "文字颜色", exact: true }).click();
  await page.getByLabel("文字 HEX", { exact: true }).fill("#171717");
  await page.getByRole("button", { name: "关闭调色板" }).click();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .inline-color")
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe("rgb(23, 23, 23)");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .inline-color")
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe("rgb(0, 0, 255)");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".free-source-paper .inline-color")
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe("rgb(0, 0, 255)");
  await page.evaluate(() => {
    window.print = () => {
      (window as any).__printed = true;
    };
  });
  await page
    .locator(".free-right")
    .getByRole("button", { name: "导出 PDF", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__printed))
    .toBe(true);
  await expect(page.locator(".free-print .inline-color").first()).toHaveCSS(
    "color",
    "rgb(0, 0, 255)",
  );
  expect(errors).toEqual([]);
});

test("toolbar is centered, purple rules run through the title center, and theme motion preserves paper", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const center = await page.locator(".source-toolbar").evaluate((el) => {
    const frame = el.getBoundingClientRect(),
      actions = el.querySelector(".toolbar-actions")!.getBoundingClientRect();
    return Math.abs(
      actions.x + actions.width / 2 - (frame.x + frame.width / 2),
    );
  });
  expect(center).toBeLessThan(1);
  await page
    .getByRole("button", { name: "使用紫图 · 研发履历模板", exact: true })
    .click();
  await expect(page.locator(".paper-workspace .row-section").first()).toHaveCSS(
    "display",
    "flex",
  );
  await expect(page.locator(".paper-workspace .row-section").first()).toHaveCSS(
    "border-bottom-color",
    "rgba(0, 0, 0, 0)",
  );
  const original = await page.locator(".resume-paper").evaluate((el) => ({
    html: el.innerHTML,
    box: el.getBoundingClientRect().toJSON(),
    color: getComputedStyle(el).backgroundColor,
  }));
  await page.getByRole("button", { name: "夜间模式", exact: true }).click();
  await expect(page.locator(".studio")).toHaveClass(/is-dark/);
  await expect
    .poll(() =>
      page
        .locator(".resume-paper")
        .evaluate((el) => el.style.viewTransitionName),
    )
    .toBe("");
  await expect(page.locator(".resume-paper")).toHaveCSS(
    "background-color",
    original.color,
  );
  const after = await page
    .locator(".resume-paper")
    .evaluate((el) => el.getBoundingClientRect().toJSON());
  expect(after).toEqual(original.box);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(
    page.getByRole("button", { name: "插入邮箱图标", exact: true }),
  ).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).hover();
  await expect(
    page.getByRole("button", { name: "插入邮箱图标", exact: true }),
  ).toHaveCSS("border-top-color", "rgb(102, 102, 95)");
  await page.screenshot({ path: "../review-dark.png" });
  await page
    .getByRole("button", { name: "夜间模式", exact: true })
    .evaluate((el) => {
      for (let i = 0; i < 7; i++) (el as HTMLButtonElement).click();
    });
  await expect(page.locator(".studio")).not.toHaveClass(/is-dark/);
  await expect
    .poll(() =>
      page
        .locator(".resume-paper")
        .first()
        .evaluate((el) => el.style.viewTransitionName),
    )
    .toBe("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "夜间模式", exact: true }).click();
  await expect(page.locator(".studio")).toHaveClass(/is-dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Markdown", exact: true }).count();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
