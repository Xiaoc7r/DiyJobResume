import { test, expect } from "@playwright/test";
import path from "node:path";

async function saved(page: import("@playwright/test").Page) {
  await expect(page.getByRole("status").first()).toContainText("已保存");
  return page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
    return library.items.find((item: any) => item.id === library.activeId).doc;
  });
}

test("manufacture a reusable template without changing the resume, save, apply, reload and edit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const original = await saved(page);
  await page.getByRole("tab", { name: "模板制造", exact: true }).click();
  await expect(page.getByLabel("模板名称", { exact: true })).toBeVisible();
  await expect(page.locator(".free-source-paper")).toContainText("示例姓名");
  const mockName = page.locator(".free-source-paper .row-name");
  await mockName.focus();
  await page.keyboard.press("End");
  await page.keyboard.type("ABC");
  await expect(mockName).toHaveText("示例姓名ABC");
  await expect(
    page.getByRole("button", { name: "分隔线", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "新增自由页", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "分隔线", exact: true }).click();
  await page.getByLabel("模板名称", { exact: true }).fill("我的线条模板");
  await page.getByRole("button", { name: "预览模板", exact: true }).click();
  await expect(page.locator(".template-maker")).toHaveClass(/is-preview/);
  await expect
    .poll(() =>
      page
        .locator(".free-source-paper .row-section")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    )
    .not.toBe("none");
  expect((await saved(page)).lines).toEqual(original.lines);
  await page.screenshot({ path: "../maker-preview.png" });
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "使用我的线条模板模板", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".template-card").first()).toHaveAttribute(
    "aria-label",
    "使用我的线条模板模板",
  );
  expect(await saved(page)).toEqual(original);
  await page
    .getByRole("button", { name: "使用我的线条模板模板", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).templateStyle?.name)
    .toBe("我的线条模板");
  const applied = await saved(page);
  expect(applied.lines).toEqual(original.lines);
  expect(applied.pictures).toEqual(original.pictures);
  expect(applied.freeform).toEqual(original.freeform);
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-section")
        .evaluateAll((rows) =>
          rows.every((row) => getComputedStyle(row).backgroundImage !== "none"),
        ),
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "使用我的线条模板模板", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-section")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    )
    .not.toBe("none");
  await page.getByRole("tab", { name: "拼接内容", exact: true }).click();
  await page
    .getByRole("button", { name: "添加自定义板块", exact: true })
    .dblclick();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-section")
        .filter({ hasText: "自定义板块" })
        .evaluateAll(
          (rows) =>
            rows.length > 0 &&
            rows.every((el) => getComputedStyle(el).backgroundImage !== "none"),
        ),
    )
    .toBe(true);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".free-source-paper .row-section")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    )
    .not.toBe("none");
  await page.evaluate(() => {
    window.print = () => {
      (window as any).__makerPrintReady = true;
    };
  });
  await page
    .locator(".free-right")
    .getByRole("button", { name: "导出 PDF", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__makerPrintReady))
    .toBe(true);
  await expect(page.locator(".free-print .row-name").first()).toHaveText(
    "炒肉多",
  );
  await expect
    .poll(() =>
      page
        .locator(".free-print .row-section")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    )
    .not.toBe("none");
  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.toString("latin1")).toContain("/ToUnicode");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.getByRole("tab", { name: "整套模板", exact: true }).click();
  await page
    .getByRole("button", { name: "编辑模板 我的线条模板", exact: true })
    .click();
  await expect(page.getByLabel("模板名称", { exact: true })).toHaveValue(
    "我的线条模板",
  );
  await page.getByLabel("绘制使用范围", { exact: true }).selectOption("page");
  await page
    .locator('.free-studio input[type="file"]')
    .setInputFiles(path.resolve("src/assets/company.png"));
  await expect(page.getByRole("button", { name: /^画布元素/ })).toContainText(
    "2",
  );
  await page.getByLabel("模板名称", { exact: true }).fill("更新后的模板");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.locator(".user-template-entry")).toHaveCount(1);
  const drawings = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("diyjobresume.templates.v1")!)[0].drawings
        .pages[0].canvas.objects,
  );
  expect(drawings.map((object: any) => object.templateRole).sort()).toEqual([
    "page",
    "section",
  ]);
  await expect(
    page.getByRole("button", { name: "使用更新后的模板模板", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "模板制造", exact: true }).click();
  await expect(page.getByLabel("模板名称", { exact: true })).toHaveValue(
    "我的模板",
  );
  await page.getByLabel("模板名称", { exact: true }).fill("未完成的草稿");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page.getByRole("tab", { name: "模板制造", exact: true }).click();
  await expect(page.getByLabel("模板名称", { exact: true })).toHaveValue(
    "未完成的草稿",
  );
  await page.getByRole("button", { name: "夜间模式", exact: true }).click();
  await page.screenshot({ path: "../maker-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../maker-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("header choices align both name and contact independently of template selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "拼接内容", exact: true }).click();
  await page.getByRole("button", { name: /姓名与联系方式左对齐/ }).dblclick();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-header")
        .evaluateAll((rows) =>
          rows.map((el) => getComputedStyle(el).textAlign),
        ),
    )
    .toEqual(["left", "left"]);
  await page.getByRole("tab", { name: "整套模板", exact: true }).click();
  await page
    .getByRole("button", { name: "使用黑线 · 专业履历模板", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-header")
        .evaluateAll((rows) =>
          rows.map((el) => getComputedStyle(el).textAlign),
        ),
    )
    .toEqual(["left", "left"]);
  await page.getByRole("tab", { name: "拼接内容", exact: true }).click();
  await page.getByRole("button", { name: /姓名与联系方式居中/ }).dblclick();
  await expect
    .poll(() =>
      page
        .locator(".paper-workspace .row-header")
        .evaluateAll((rows) =>
          rows.map((el) => getComputedStyle(el).textAlign),
        ),
    )
    .toEqual(["center", "center"]);
});
