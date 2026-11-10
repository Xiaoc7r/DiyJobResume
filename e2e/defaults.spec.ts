import { test, expect } from "@playwright/test";

test("uncached first visit and all six sample templates use the requested layout and three editable images", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("100");
  for (const template of [
    "炒肉多经典",
    "蓝图 · 研发履历",
    "黑线 · 专业履历",
    "标签 · 技术履历",
    "红序 · 系统架构",
    "青岚 · 工程实践",
  ]) {
    await page
      .getByRole("button", { name: `使用${template}模板`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "载入当前模板示例", exact: true })
      .click();
    await expect(page.locator(".resume-paper")).toHaveCount(1);
    await expect(page.locator(".resume-paper")).toHaveCSS(
      "padding",
      "30px 42px",
    );
    const headerClear = await page
      .locator(".resume-paper")
      .evaluate((paper) => {
        const logo = paper
            .querySelector(".floating-picture:not([data-anchor])")!
            .getBoundingClientRect(),
          r = document.createRange();
        r.selectNodeContents(paper.querySelector(".row-name .ink")!);
        const title = r.getBoundingClientRect();
        return (
          title.left >= logo.right ||
          title.right <= logo.left ||
          title.top >= logo.bottom ||
          title.bottom <= logo.top
        );
      });
    expect(headerClear).toBe(true);
    const before = await page
      .locator(".floating-picture[data-anchor]")
      .evaluateAll((els) =>
        els.map((el) => {
          const paper = el.closest(".resume-paper")!.getBoundingClientRect(),
            r = el.getBoundingClientRect();
          return {
            id: (el as HTMLElement).dataset.pictureId,
            x: r.left - paper.left,
            y: r.top - paper.top,
          };
        }),
      );
    expect(before).toHaveLength(3);
    await page.getByRole("tab", { name: "自由模式", exact: true }).click();
    await page.getByRole("button", { name: /^画布元素/ }).click();
    await expect(page.locator(".free-object-name")).toHaveText([
      "京东.png",
      "京东.png",
      "视频.png",
    ]);
    await expect(
      page.locator(".free-source-paper .floating-picture"),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
    await expect(page.locator(".free-layer-foreground svg image")).toHaveCount(
      3,
    );
    await expect(page.getByRole("status").first()).toContainText("已保存");
    const saved = await page.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
      return lib.items.find((d: any) => d.id === lib.activeId).doc;
    });
    const objects = saved.freeform.pages[0].canvas.objects;
    expect(objects).toHaveLength(3);
    for (const rect of before) {
      const object = objects.find((o: any) => o.id === rect.id);
      expect(object.type).toBe("Image");
      expect(object.left).toBeCloseTo(rect.x, 1);
      expect(object.top).toBeCloseTo(rect.y, 1);
    }
  }
  await page.reload();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await expect(page.locator(".free-object-name")).toHaveText([
    "京东.png",
    "京东.png",
    "视频.png",
  ]);
});
