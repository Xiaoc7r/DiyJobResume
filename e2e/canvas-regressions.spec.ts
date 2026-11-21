import { test, expect } from "@playwright/test";

async function openCanvas(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("预览缩放", { exact: true }).fill("100");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
}
async function elements(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^画布元素/ }).click();
}

test("crest is selectable, editable, copyable and keeps transparent/white variants across modes and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openCanvas(page);
  await elements(page);
  await page
    .locator(".free-object-name")
    .filter({ hasText: "校徽透明底" })
    .click();
  await page.getByLabel("元素 X 位置", { exact: true }).fill("100");
  await page.getByLabel("元素 Y 位置", { exact: true }).fill("25");
  await page.getByLabel("元素宽度", { exact: true }).fill("64");
  await page.getByRole("button", { name: "复制选中元素", exact: true }).click();
  await expect(
    page.locator(".free-object-name").filter({ hasText: "校徽副本透明底" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const crest = page.locator('.floating-picture:has(img[alt="校徽"])');
  await expect(crest).toHaveCSS("left", "100px");
  await expect(crest).toHaveCSS("top", "25px");
  await expect(crest).toHaveCSS("width", "64px");
  await page.getByRole("button", { name: "使用紫横模板", exact: true }).click();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await page
    .locator(".free-object-name")
    .filter({ hasText: /^校徽白底$/ })
    .click();
  await expect(
    page.locator('.free-front-scene svg rect[fill="#ffffff"]'),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "复制选中元素", exact: true }).click();
  await expect(
    page.locator(".free-object-name").filter({ hasText: "校徽副本白底" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(crest).toHaveCSS("left", "100px");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await expect(
    page.locator(".free-object-name").filter({ hasText: "校徽副本" }),
  ).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("out-of-page stroked elements shrink and grow exactly; paper controls do not move or scale elements", async ({
  page,
}) => {
  await openCanvas(page);
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  await page.getByLabel("描边宽度", { exact: true }).fill("3");
  await page.getByRole("checkbox", { name: "调整尺寸时锁定比例" }).uncheck();
  await page.getByLabel("元素 X 位置", { exact: true }).fill("1100");
  await page.getByLabel("元素 Y 位置", { exact: true }).fill("1300");
  for (const name of ["元素宽度", "元素高度"]) {
    const input = page.getByLabel(name, { exact: true });
    await input.fill("100");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("99");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("98");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("99");
  }
  await page.keyboard.press("Escape"); // blur the number field, then clear the selection
  await page.getByRole("button", { name: "选择与编辑", exact: true }).focus();
  await page.keyboard.press("Escape");
  const width = page.getByLabel("自由纸张宽度", { exact: true }),
    height = page.getByLabel("自由纸张高度", { exact: true });
  await width.press("ArrowDown");
  await expect(width).toHaveValue("793");
  await width.press("ArrowUp");
  await expect(width).toHaveValue("794");
  await height.press("ArrowDown");
  await expect(height).toHaveValue("1164");
  await height.press("ArrowUp");
  await expect(height).toHaveValue("1165");
  await elements(page);
  await page.locator(".free-object-name").filter({ hasText: "矩形" }).click();
  await expect(page.getByLabel("元素 X 位置", { exact: true })).toHaveValue(
    "1100",
  );
  await expect(page.getByLabel("元素 Y 位置", { exact: true })).toHaveValue(
    "1300",
  );
  await expect(page.getByLabel("元素宽度", { exact: true })).toHaveValue("99");
});

test("corners and center move; the complete edges resize without jumping", async ({
  page,
}) => {
  await openCanvas(page);
  await page.getByRole("checkbox", { name: "吸附", exact: true }).uncheck();
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  await page.getByLabel("描边宽度", { exact: true }).fill("0");
  await page.getByRole("checkbox", { name: "调整尺寸时锁定比例" }).uncheck();
  for (const [label, value] of [
    ["元素 X 位置", "300"],
    ["元素 Y 位置", "300"],
    ["元素宽度", "200"],
    ["元素高度", "120"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  const box = await page.locator(".free-canvas-host").boundingBox();
  const drag = async (x: number, y: number, dx: number, dy: number) => {
    await page.mouse.move(box!.x + x, box!.y + y);
    await page.mouse.down();
    await page.mouse.move(box!.x + x + dx, box!.y + y + dy, { steps: 8 });
    await page.mouse.up();
  };
  await drag(300, 300, 20, 15);
  await expect(page.getByLabel("元素 X 位置", { exact: true })).toHaveValue(
    "320",
  );
  await expect(page.getByLabel("元素 Y 位置", { exact: true })).toHaveValue(
    "315",
  );
  await expect(page.getByLabel("元素宽度", { exact: true })).toHaveValue("200");
  await drag(520, 345, 25, 0);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("元素宽度", { exact: true }).inputValue()),
    )
    .toBeCloseTo(225, 0);
  await drag(376, 315, 0, -10);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("元素高度", { exact: true }).inputValue()),
    )
    .toBeCloseTo(130, 0);
  await drag(320, 337.5, -15, 0);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("元素宽度", { exact: true }).inputValue()),
    )
    .toBeCloseTo(240, 0);
  await drag(365, 435, 0, 12);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("元素高度", { exact: true }).inputValue()),
    )
    .toBeCloseTo(142, 0);
  const x = Number(
      await page.getByLabel("元素 X 位置", { exact: true }).inputValue(),
    ),
    y = Number(
      await page.getByLabel("元素 Y 位置", { exact: true }).inputValue(),
    );
  await drag(x + 120, y + 71, 10, 10);
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("元素 X 位置", { exact: true }).inputValue(),
      ),
    )
    .toBeCloseTo(x + 10, 0);
});

test("template artwork can be moved and copied, stays per template, and survives reload", async ({
  page,
}) => {
  await openCanvas(page);
  await elements(page);
  await page
    .locator(".free-art-name")
    .filter({ hasText: "教育背景 · 分隔线" })
    .click();
  await page.getByLabel("元素 Y 位置", { exact: true }).fill("180");
  await page.getByRole("button", { name: "复制选中元素", exact: true }).click();
  await expect(
    page.locator(".free-object-name").filter({ hasText: "分隔线副本" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(page.locator(".resume-paper")).toHaveClass(/bound-template-art/);
  await page.getByRole("button", { name: "使用紫横模板", exact: true }).click();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await expect(
    page.locator(".free-art-name").filter({ hasText: "页首横幅" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page
    .getByRole("button", { name: "使用炒肉多经典模板", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await page
    .locator(".free-art-name")
    .filter({ hasText: "教育背景 · 分隔线" })
    .click();
  await expect(page.getByLabel("元素 Y 位置", { exact: true })).toHaveValue(
    "180",
  );
});

test("uploaded photos and crests share canvas editing, deletion and undo", async ({
  page,
}) => {
  await page.goto("/");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a80sAAAAASUVORK5CYII=",
    "base64",
  );
  for (const kind of ["证件照", "校徽"]) {
    await page
      .getByRole("button", { name: "上传" + kind, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "上传" + kind,
      exact: true,
    });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: kind + ".png",
      mimeType: "image/png",
      buffer: png,
    });
    await dialog.getByRole("button", { name: "确认添加", exact: true }).click();
  }
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await expect(
    page.locator(".free-object-name").filter({ hasText: "校徽透明底" }),
  ).toHaveCount(1);
  await page
    .locator(".free-object-name")
    .filter({ hasText: "证件照透明底" })
    .click();
  await page.getByLabel("元素 X 位置", { exact: true }).fill("580");
  await page.getByRole("button", { name: "自由模式撤销", exact: true }).click();
  await page
    .locator(".free-object-name")
    .filter({ hasText: "证件照透明底" })
    .click();
  await expect(page.getByLabel("元素 X 位置", { exact: true })).toHaveValue(
    "680",
  );
  await page.getByRole("button", { name: "自由模式重做", exact: true }).click();
  await page
    .locator(".free-object-name")
    .filter({ hasText: "证件照透明底" })
    .click();
  await expect(page.getByLabel("元素 X 位置", { exact: true })).toHaveValue(
    "580",
  );
  await page.getByRole("button", { name: "删除选中元素", exact: true }).click();
  await expect(
    page.locator(".free-object-name").filter({ hasText: "证件照" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "自由模式撤销", exact: true }).click();
  await expect(
    page.locator(".free-object-name").filter({ hasText: "证件照" }),
  ).toHaveCount(1);
  await page.locator(".free-object-name").filter({ hasText: "证件照" }).click();
  await page.getByRole("button", { name: "切换黑白", exact: true }).click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await elements(page);
  await expect(
    page.locator(".free-object-name").filter({ hasText: "证件照" }),
  ).toHaveCount(1);
  const stored = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
    const doc = library.items.find(
      (item: { id: string }) => item.id === library.activeId,
    ).doc;
    return {
      photos: doc.pictures.filter(
        (p: { label: string }) => p.label === "证件照",
      ).length,
      filters: doc.freeform.pages[0].canvas.objects
        .find((o: { label: string }) => o.label === "证件照")
        .filters.map((f: { type: string }) => f.type),
    };
  });
  expect(stored).toEqual({ photos: 0, filters: ["Grayscale"] });
});
