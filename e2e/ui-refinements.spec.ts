import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});
async function selectName(page: Page) {
  await page
    .locator(".simple-editor .simple-input")
    .first()
    .evaluate((el) => {
      (el.closest(".simple-editor") as HTMLElement).focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await page.getByRole("button", { name: "文字颜色", exact: true }).click();
}
async function free(page: Page) {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
}

test("rich and Markdown selections accept repeated palette clicks without reselection or nested colors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await selectName(page);
  let palette = page.getByRole("dialog", { name: "文字调色板", exact: true });
  for (const point of [
    { x: 30, y: 40 },
    { x: 180, y: 80 },
    { x: 90, y: 110 },
  ]) {
    await palette
      .getByRole("slider", { name: "饱和度与亮度" })
      .click({ position: point });
    const hex = await palette
      .getByLabel("文字 HEX", { exact: true })
      .inputValue();
    await expect(
      page.locator(".paper-workspace .row-name .inline-color"),
    ).toHaveAttribute("data-inline-color", hex);
  }
  await palette
    .getByRole("button", { name: "文字色：经典蓝", exact: true })
    .click();
  await expect(
    page.locator(".paper-workspace .row-name .inline-color"),
  ).toHaveAttribute("data-inline-color", "#1059a5");
  await palette.getByRole("button", { name: "关闭调色板" }).click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const editor = page.getByLabel("Markdown 简历内容");
  const value = await editor.inputValue(),
    start = value.indexOf("炒肉多");
  await editor.focus();
  await editor.evaluate(
    (el: HTMLTextAreaElement, at) => el.setSelectionRange(at, at + 3),
    start,
  );
  await page.getByRole("button", { name: "文字颜色", exact: true }).click();
  palette = page.getByRole("dialog", { name: "文字调色板", exact: true });
  for (const name of ["酒红", "墨黑", "经典蓝"]) {
    await palette
      .getByRole("button", { name: "文字色：" + name, exact: true })
      .click();
    const line = (await editor.inputValue()).split("\n")[0];
    expect(line.match(/<span/g)).toHaveLength(1);
    expect(line).toContain("炒肉多");
  }
  await palette.getByRole("button", { name: "关闭调色板" }).click();
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(
    page.locator(".paper-workspace .row-name .inline-color"),
  ).toHaveAttribute("data-inline-color", "#1059a5");
  await selectName(page);
  await page.getByRole("button", { name: "文字色：酒红", exact: true }).click();
  await page.getByRole("button", { name: "关闭调色板", exact: true }).click();
  await page.getByRole("button", { name: "斜体", exact: true }).click();
  await expect(page.locator(".paper-workspace .row-name em")).toHaveText(
    "炒肉多",
  );
  expect(errors).toEqual([]);
});

test("canvas sampling has a pixel magnifier, accurate HEX and cancellation", async ({
  page,
}) => {
  await page.getByLabel("预览缩放", { exact: true }).fill("100");
  await page.getByRole("button", { name: "主题颜色", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "主题调色板", exact: true });
  await panel.getByRole("button", { name: "画布取色", exact: true }).click();
  const box = await page
    .locator(".paper-workspace .resume-paper")
    .boundingBox();
  await page.mouse.move(box!.x + 140, box!.y + 12);
  const lens = page.getByLabel("像素取色放大镜", { exact: true });
  await expect(lens).toBeVisible({ timeout: 30000 });
  await expect(lens.locator("strong")).toHaveText("#ffffff");
  await expect(lens.locator("canvas")).toHaveAttribute("width", "110");
  await page.mouse.click(box!.x + 140, box!.y + 12);
  await expect(panel.getByLabel("主题 HEX", { exact: true })).toHaveValue(
    "#ffffff",
  );
  await expect(lens).toHaveCount(0);
  await panel.getByRole("button", { name: "画布取色", exact: true }).click();
  await panel.getByRole("button", { name: "取消取色", exact: true }).click();
  await expect(panel).not.toHaveClass(/is-picking/);
});

test("four modes have identical panel geometry, neutral night controls, and mode-specific workshop help", async ({
  page,
}) => {
  const dimensions: unknown[] = [];
  for (const mode of ["简单编辑", "Markdown", "自由模式", "模板制造"]) {
    await page.getByRole("tab", { name: mode, exact: true }).click();
    if (mode === "自由模式")
      await expect(
        page.getByRole("button", { name: "插入QQ图标", exact: true }),
      ).toBeEnabled();
    if (mode === "模板制造")
      await expect(
        page.getByRole("button", { name: "保存模板", exact: true }),
      ).toBeEnabled();
    const heading = page
      .locator(".library-heading, .free-properties-heading")
      .first();
    dimensions.push(
      await heading.evaluate((el) => {
        const h = el.querySelector("h2")!,
          r = el.getBoundingClientRect(),
          text = h.getBoundingClientRect(),
          s = getComputedStyle(h);
        return {
          y: r.y,
          height: r.height,
          width: r.width,
          textY: text.y - r.y,
          font: s.fontSize,
          weight: s.fontWeight,
          editor: document
            .querySelector(".editor-heading")!
            .getBoundingClientRect().height,
        };
      }),
    );
    if (mode !== "自由模式")
      await expect(page.locator(".preview-toolbar .font-label")).toContainText(
        "字体",
      );
  }
  expect(dimensions).toEqual(Array(4).fill(dimensions[0]));
  await page
    .getByRole("button", { name: "模板制造使用帮助", exact: true })
    .click();
  await expect(page.locator(".free-help")).toContainText("做一套自己的模板");
  await expect(page.locator(".free-help")).toContainText("保存模板");
  await expect(page.locator(".free-help")).not.toContainText(
    "自由摆放简历元素",
  );
  await page.getByRole("button", { name: "知道了", exact: true }).click();
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.mouse.move(1, 1);
  const backgrounds = async () =>
    page
      .locator(".zoom-control button, .library-tabs button, .document-name")
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).backgroundColor),
      );
  const day = await backgrounds();
  await page.getByRole("button", { name: "夜间模式", exact: true }).click();
  expect(await backgrounds()).toEqual(day);
  await free(page);
  await page.mouse.move(1, 1);
  expect(
    await page
      .locator(".free-icons button")
      .evaluateAll((els) =>
        els.every(
          (e) => getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)",
        ),
      ),
  ).toBe(true);
  await page.screenshot({ path: "../ui-refine-night.png" });
});

test("icon order, useful shapes and contact links are available without adding clutter", async ({
  page,
}) => {
  await page.getByRole("button", { name: "联系方式", exact: true }).click();
  await expect(
    page.locator('.contact-popover a[href="mailto:xxiaocr@gmail.com"] svg'),
  ).toHaveCount(1);
  await expect(
    page.locator('.contact-popover a[href*="xiaohongshu.com"]'),
  ).toContainText("炒肉多");
  await page.getByRole("button", { name: "联系方式", exact: true }).click();
  await free(page);
  expect(await page.locator(".free-icons button").allTextContents()).toEqual([
    "邮箱",
    "电话",
    "教育",
    "工作",
    "奖项",
    "Base地",
    "网站",
    "链接",
    "GitHub",
    "Gitee",
    "微信",
    "QQ",
    "LinkedIn",
    "Telegram",
    "抖音",
    "作品集",
  ]);
  expect(
    await page.locator(".free-left .free-side-scroll h3").allTextContents(),
  ).toEqual(["常用图标", "图片与图形", "文字与板块", "表格"]);
  for (const name of ["虚线", "箭头", "曲线", "圆角矩形"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  for (const name of ["虚线", "箭头", "曲线", "圆角矩形"])
    await expect(
      page.locator(".free-object-name").filter({ hasText: name }),
    ).toHaveCount(1);
});
