import { test, expect } from "@playwright/test";

test("new skins keep the sample on one page with identical 29px headings and aligned canvas elements", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("预览缩放", { exact: true }).fill("100");
  const geometry = () =>
    page
      .locator(".resume-paper")
      .first()
      .evaluate((paper) => {
        const root = paper.getBoundingClientRect(),
          scale = root.width / 794;
        return [...paper.querySelectorAll<HTMLElement>("[data-edit]")].map(
          (el) => {
            const box = el.getBoundingClientRect();
            return {
              text: el.textContent,
              x: (box.x - root.x) / scale,
              y: (box.y - root.y) / scale,
              h: box.height / scale,
            };
          },
        );
      });
  const original = await geometry();
  await expect(page.locator(".free-layer-foreground svg image")).toHaveCount(3);
  const iconGeometry = () =>
    page.locator(".free-layer-foreground svg image").evaluateAll((nodes) =>
      nodes.map((el) => {
        const box = el.getBoundingClientRect(),
          root = el.closest(".resume-paper")!.getBoundingClientRect(),
          scale = root.width / 794;
        return {
          x: (box.x - root.x) / scale,
          y: (box.y - root.y) / scale,
          w: box.width / scale,
          h: box.height / scale,
        };
      }),
    );
  const originalIcons = await iconGeometry();
  for (const name of ["黑调", "复试", "紫横"]) {
    await page
      .getByRole("button", { name: `使用${name}模板`, exact: true })
      .click();
    await expect(page.locator(".paper-workspace .resume-paper")).toHaveCount(1);
    const compare = async () => {
      const current = await geometry();
      expect(current.map((line) => line.text)).toEqual(
        original.map((line) => line.text),
      );
      current.forEach((line, i) => {
        expect(Math.abs(line.x - original[i].x)).toBeLessThan(0.05);
        expect(Math.abs(line.y - original[i].y)).toBeLessThan(0.05);
        expect(Math.abs(line.h - original[i].h)).toBeLessThan(0.05);
      });
    };
    await compare();
    const sections = page.locator(".paper-workspace .row-section");
    expect(
      await sections.evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().height),
      ),
    ).toEqual([29, 29, 29, 29]);
    // The colored header may not touch the contact line or obscure the crest.
    if (name === "紫横") {
      const clear = await page
        .locator(".resume-paper")
        .first()
        .evaluate((paper) => {
          const banner = getComputedStyle(paper, "::before");
          const contact = paper.querySelectorAll<HTMLElement>(".row-header")[1];
          return (
            parseFloat(banner.top) + parseFloat(banner.height) <=
            contact.getBoundingClientRect().top -
              paper.getBoundingClientRect().top
          );
        });
      expect(clear).toBe(true);
    }
    await page.getByRole("tab", { name: "自由模式", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "插入QQ图标", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".free-front-scene svg image")).toHaveCount(4);
    await compare();
    await page.getByRole("tab", { name: "Markdown", exact: true }).click();
    await expect(page.locator(".paper-workspace .resume-paper")).toHaveCount(1);
    await compare();
    await expect(page.locator(".free-layer-foreground svg image")).toHaveCount(
      3,
    );
    const currentIcons = await iconGeometry();
    currentIcons.forEach((box, i) => {
      for (const key of ["x", "y", "w", "h"] as const)
        expect(Math.abs(box[key] - originalIcons[i][key])).toBeLessThan(0.05);
    });
  }
});
