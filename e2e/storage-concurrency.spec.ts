import { test, expect } from "@playwright/test";

test("switching color controls by pointer or keyboard cancels the previous sampler", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "主题颜色", exact: true }).click();
  await page.getByRole("button", { name: "画布取色", exact: true }).click();
  await page.getByRole("button", { name: "正文颜色", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "主题调色板", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/color-picking/);
  await page.getByRole("button", { name: "画布取色", exact: true }).click();
  await page.getByRole("button", { name: "主题颜色", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "正文调色板", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "主题调色板", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/color-picking/);
});

test("a stale tab preserves another tab's resume and keeps conflicting local text available", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByRole("status").first()).toContainText("已保存");
  await page.getByLabel("简历名称", { exact: true }).fill("标签一已保存的内容");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await second
    .getByLabel("简历名称", { exact: true })
    .fill("标签二未覆盖的内容");
  await expect(second.getByRole("status").first()).toContainText("保存失败");
  await expect(second.getByText(/另一标签页已修改这份简历/)).toBeVisible();
  await expect(second.getByLabel("简历名称", { exact: true })).toHaveValue(
    "标签二未覆盖的内容",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!).items[0].name,
    ),
  ).toBe("标签一已保存的内容");
  await second.close();
});

test("AI panel is fetched on demand and aborts a connectivity check when closed", async ({
  page,
}) => {
  const chunks: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/AgentPanel-[^/]+\.js/.test(request.url()))
      chunks.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByLabel("简历名称", { exact: true })).toBeVisible();
  expect(chunks).toEqual([]);
  await page.getByRole("button", { name: "排版助手", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "接口设置", exact: true }),
  ).toBeVisible();
  expect(chunks).toHaveLength(1);
  await page.getByRole("button", { name: "接口设置", exact: true }).click();
  await page
    .getByLabel("接口地址", { exact: true })
    .fill("https://ai-test.invalid/v1");
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = (input, options) => {
      if (!String(input).startsWith("https://ai-test.invalid"))
        return original(input, options);
      (window as any).pendingAI = true;
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => {
            (window as any).aiAborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    };
  });
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).pendingAI))
    .toBe(true);
  await page.getByRole("button", { name: "关闭排版助手", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).aiAborted))
    .toBe(true);
});
