import { test, expect } from "@playwright/test";

const source = "# 姓名\n\n## 经验\n甲段内容\n乙段内容\n丙段内容";
async function seed(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 简历内容").fill(source);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
}

test("simple editing selects and replaces the whole document without deleting row containers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  const editor = page.getByRole("textbox", {
    name: "简单编辑内容",
    exact: true,
  });
  await page.locator("[data-simple]").first().click();
  await page.keyboard.press("Control+a");
  const selected = await page.evaluate(() => getSelection()?.toString());
  expect(selected).toContain("姓名");
  expect(selected).toContain("丙段内容");
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-simple]")).toHaveCount(1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(editor).toContainText("丙段内容");
  await page.locator("[data-simple]").first().click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText("全新内容");
  await expect(editor).toContainText("全新内容");
  await expect(editor).not.toContainText("丙段内容");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(page.getByLabel("Markdown 简历内容")).toHaveValue("# 全新内容");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.locator("[data-simple]").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("第二行");
  await expect(page.locator("[data-simple]")).toHaveCount(2);
  await expect(page.locator("[data-simple]").last()).toHaveText("第二行");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  expect(await page.getByLabel("Markdown 简历内容").inputValue()).toContain(
    "第二行",
  );
  expect(errors).toEqual([]);
});

test("simple editing supports cross-paragraph formatting and partial deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.locator("[data-simple]").nth(2).click();
  await page.evaluate(() => {
    const rows = document.querySelectorAll("[data-simple]"),
      range = document.createRange();
    const a = document
        .createTreeWalker(rows[2], NodeFilter.SHOW_TEXT)
        .nextNode()!,
      b = document.createTreeWalker(rows[4], NodeFilter.SHOW_TEXT).nextNode()!;
    range.setStart(a, 1);
    range.setEnd(b, 2);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await page.getByRole("button", { name: "加粗", exact: true }).click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  expect(await page.getByLabel("Markdown 简历内容").inputValue()).toContain(
    "**乙段内容**",
  );
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.locator("[data-simple]").nth(2).click();
  await page.evaluate(() => {
    const rows = document.querySelectorAll("[data-simple]"),
      range = document.createRange();
    range.setStart(
      document.createTreeWalker(rows[2], NodeFilter.SHOW_TEXT).nextNode()!,
      0,
    );
    range.setEnd(
      document.createTreeWalker(rows[4], NodeFilter.SHOW_TEXT).nextNode()!,
      1,
    );
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("textbox", { name: "简单编辑内容", exact: true }),
  ).not.toContainText("乙段内容");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "简单编辑内容", exact: true }),
  ).toContainText("乙段内容");
  expect(errors).toEqual([]);
});

test("Markdown gutter, dark interface and side-panel bookmarks work in every mode", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("button", { name: "编辑区", exact: true }),
  ).toHaveCount(0);
  const paper = page.locator(".paper-workspace .resume-paper").first();
  const before = await paper.evaluate((el) => ({
    html: el.innerHTML,
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  await page.getByRole("button", { name: "夜间模式", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await paper.evaluate((el) => ({
      html: el.innerHTML,
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    })),
  ).toEqual(before);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect
    .poll(async () => page.locator(".markdown-numbers span").count())
    .toBe(
      (await page.getByLabel("Markdown 简历内容").inputValue()).split("\n")
        .length,
    );
  await page.getByLabel("Markdown 简历内容").evaluate((el) => {
    el.scrollTop = 180;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator(".markdown-numbers > div")).toHaveCSS(
    "transform",
    /matrix/,
  );
  await page.screenshot({ path: "../cohesion-dark-markdown.png" });
  await page.getByRole("button", { name: "收起编辑区", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "展开编辑区", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "展开编辑区", exact: true }).click();
  await page.getByRole("button", { name: "收起样式面板", exact: true }).click();
  await page.getByRole("button", { name: "展开右侧面板", exact: true }).click();
  await page.getByRole("button", { name: "排版助手", exact: true }).click();
  await expect(page.locator(".agent-panel")).toBeVisible();
  await page.getByRole("button", { name: "排版助手", exact: true }).click();
  await page.getByRole("tab", { name: "拼接内容", exact: true }).click();
  await expect(page.locator(".library-scroll button").first()).toHaveText(
    "添加自定义板块",
  );
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-icons button")).toHaveCount(20);
  await expect(page.locator(".free-upload-primary")).toBeVisible();
  await page.getByRole("button", { name: "排版助手", exact: true }).click();
  await expect(page.locator(".free-studio .agent-panel")).toBeVisible();
  await page.getByRole("button", { name: "排版助手", exact: true }).click();
  await expect(page.locator(".free-right")).toBeVisible();
  await page.getByRole("button", { name: "收起编辑区", exact: true }).click();
  await page.getByRole("button", { name: "展开编辑区", exact: true }).click();
  await page.getByRole("button", { name: "收起样式面板", exact: true }).click();
  await page.getByRole("button", { name: "展开右侧面板", exact: true }).click();
  await page.screenshot({ path: "../cohesion-dark-free.png" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
