import { test, expect } from "@playwright/test";
import path from "node:path";
const read = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("status").first()).toContainText("已保存");
  return page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
    return lib.items.find((x: any) => x.id === lib.activeId).doc;
  });
};
test("template workshop edits bright regions live and applies only heading and header styles", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const original = await read(page);
  await page.getByRole("tab", { name: "模板制造", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存模板", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".maker-bar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "预览模板", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("常用图标", { exact: true })).toHaveCount(0);
  await expect(page.getByText("文字与板块", { exact: true })).toHaveCount(0);
  await expect(page.getByText("当前纸张", { exact: true })).toHaveCount(0);
  await expect(page.locator(".maker-zone-outline")).toHaveCount(5);
  for (const row of await page.locator(".free-source-paper .row-section").all())
    await expect(row).toHaveCSS("color", "rgb(0, 0, 0)");
  const alignment = await page
    .locator(".free-page-frame")
    .evaluate((frame) => ({
      frame: frame.getBoundingClientRect().width,
      paper: frame.querySelector(".resume-paper")!.getBoundingClientRect()
        .width,
    }));
  expect(Math.abs(alignment.frame - alignment.paper)).toBeLessThan(1);
  await expect(page.locator(".free-source-paper .row-header").last()).toHaveCSS(
    "text-align",
    "center",
  );
  await page.getByRole("button", { name: "分隔线", exact: true }).click();
  await expect(
    page.locator(".free-source-paper .template-region-art.region-section svg"),
  ).toHaveCount(3);
  await page.getByLabel("板块标题区高度", { exact: true }).fill("45");
  await expect
    .poll(() =>
      page
        .locator(".maker-zone-outline")
        .nth(1)
        .getAttribute("height")
        .then((value) => Math.abs(Number(value) - 45)),
    )
    .toBeLessThan(0.03);
  await page.getByRole("button", { name: "自由模式撤销", exact: true }).click();
  await expect(page.getByLabel("板块标题区高度", { exact: true })).toHaveValue(
    "30",
  );
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await page.locator(".free-object-name").first().click();
  await page.getByLabel("元素 X 位置", { exact: true }).fill("10");
  await expect(page.locator(".maker-overflow-note")).toBeVisible();
  await expect(page.locator(".region-section svg").first()).toHaveCSS(
    "overflow",
    "visible",
  );
  await page.getByLabel("元素 X 位置", { exact: true }).fill("42");
  await expect(page.locator(".maker-overflow-note")).toHaveCount(0);
  await page.getByLabel("模板名称", { exact: true }).fill("实时区域模板");
  await page
    .locator('.free-studio input[type="file"]')
    .setInputFiles(path.resolve("src/assets/company.png"));
  await expect(page.getByRole("button", { name: /^画布元素/ })).toContainText(
    "2",
  );
  await expect(page.locator(".free-detail-preview")).toHaveCount(0);
  await page.screenshot({ path: "../regions-workshop.png" });
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  const card = page.getByRole("button", {
    name: "使用实时区域模板模板",
    exact: true,
  });
  await expect(card).toBeVisible();
  expect((await read(page)).lines).toEqual(original.lines);
  await card.click();
  const applied = await read(page);
  expect(applied.lines).toEqual(original.lines);
  expect(applied.pictures).toEqual(original.pictures);
  expect(applied.freeform).toEqual(original.freeform);
  expect(applied.settings).toEqual(original.settings);
  await expect(
    page.locator(".paper-workspace .template-region-art.region-section svg"),
  ).toHaveCount(4);
  await page.reload();
  await expect(
    page.locator(".paper-workspace .template-region-art.region-section svg"),
  ).toHaveCount(4);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.locator(".free-source-paper .template-region-art.region-section svg"),
  ).toHaveCount(4);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "编辑模板 实时区域模板", exact: true })
    .click();
  await expect(page.getByLabel("模板名称", { exact: true })).toHaveValue(
    "实时区域模板",
  );
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page.getByRole("tab", { name: "模板制造", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../regions-mobile.png" });
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
