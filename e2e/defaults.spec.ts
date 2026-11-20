import { test, expect } from "@playwright/test";

const names = [
  "炒肉多经典",
  "黑线 · 专业履历",
  "标签 · 技术履历",
  "红序 · 系统架构",
  "青岚 · 工程实践",
  "紫图 · 研发履历",
  "黑调",
  "复试",
  "紫横",
];
const geometry = async (page: import("@playwright/test").Page) =>
  page.locator(".resume-paper").evaluateAll((papers) =>
    papers.map((paper) => {
      const frame = paper.getBoundingClientRect(),
        z = frame.width / 794;
      return [...paper.querySelectorAll<HTMLElement>("[data-edit]")].map(
        (row) => {
          const r = row.getBoundingClientRect();
          return [
            row.dataset.edit,
            row.textContent,
            ...[r.x - frame.x, r.y - frame.y, r.width, r.height].map(
              (n) => Math.round((n / z) * 1000) / 1000,
            ),
          ];
        },
      );
    }),
  );
const saved = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("status").first()).toContainText("已保存");
  return page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
    return lib.items.find((item: any) => item.id === lib.activeId).doc;
  });
};

test("the QAQ example keeps its extended paper and six elements through all nine templates and modes", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("预览缩放", { exact: true }).fill("100");
  await expect(page.getByLabel("简历名称")).toHaveValue("炒肉多示例简历QAQ");
  expect(
    await page
      .locator(".template-card")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("aria-label")),
      ),
  ).toEqual([...names, "白板"].map((name) => `使用${name}模板`));
  const originalGeometry = await geometry(page),
    original = await saved(page);
  expect(original.freeform.pages[0]).toMatchObject({
    width: 794,
    height: 1165,
  });
  expect(original.freeform.pages[0].canvas.objects).toHaveLength(6);
  for (const name of names) {
    await page
      .getByRole("button", { name: `使用${name}模板`, exact: true })
      .click();
    await expect(page.locator(".resume-paper")).toHaveCount(1);
    expect(await geometry(page), name).toEqual(originalGeometry);
    const doc = await saved(page);
    expect(doc.lines, name).toEqual(original.lines);
    expect(doc.pictures, name).toEqual(original.pictures);
    expect(doc.freeform.pages, name).toEqual(original.freeform.pages);
    const clear = await page.locator(".resume-paper").evaluate((paper) => {
      const logo = paper
        .querySelector(".floating-picture")!
        .getBoundingClientRect();
      return [
        ".row-name .ink",
        ".paper-row:has(.row-name) + .paper-row .row-text .ink",
      ].every((selector) => {
        const range = document.createRange();
        range.selectNodeContents(paper.querySelector(selector)!);
        const r = range.getBoundingClientRect();
        return (
          r.left >= logo.right ||
          r.right <= logo.left ||
          r.top >= logo.bottom ||
          r.bottom <= logo.top
        );
      });
    });
    expect(clear, name).toBe(true);
    if (name.startsWith("青岚"))
      expect(
        await page
          .locator('.row-section [data-title="实习经历"]')
          .evaluate((el) => getComputedStyle(el, "::after").content),
      ).toBe('"Internship"');
    await page.getByRole("tab", { name: "自由模式", exact: true }).click();
    await expect(page.locator(".free-source-paper")).toBeVisible();
    await page.getByRole("button", { name: /^画布元素/ }).click();
    await expect(page.locator(".free-object-name")).toHaveText([
      "标题色带",
      "标题色带",
      "链接",
      "京东.png",
      "京东.png",
      "视频.png",
    ]);
    expect(await geometry(page), name).toEqual(originalGeometry);
    await page.getByRole("tab", { name: "Markdown", exact: true }).click();
    expect(await geometry(page), name).toEqual(originalGeometry);
    await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  }
  await page.reload();
  expect((await saved(page)).freeform.pages[0].canvas.objects).toEqual(
    original.freeform.pages[0].canvas.objects,
  );
});
