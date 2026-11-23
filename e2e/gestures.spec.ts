import { test, expect } from "@playwright/test";

test("picture pointer bursts use one geometry read, keep the final coordinates and one undo step", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("预览缩放", { exact: true }).fill("100");
  const picture = page.locator('.floating-picture:has(img[alt*="校徽"])');
  const initial = await picture.evaluate((el) => ({
    x: parseFloat((el as HTMLElement).style.left),
    y: parseFloat((el as HTMLElement).style.top),
  }));
  const box = (await picture.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await picture.evaluate((el) => {
    el.addEventListener(
      "pointerdown",
      (event) => {
        el.setAttribute(
          "data-test-pointer",
          String((event as PointerEvent).pointerId),
        );
      },
      { once: true },
    );
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const reads = await picture.evaluate((el, start) => {
    const pointerId = Number(el.getAttribute("data-test-pointer"));
    const paper = el.closest(".resume-paper")!;
    const original = paper.getBoundingClientRect;
    let reads = 0;
    paper.getBoundingClientRect = function () {
      reads++;
      return original.call(this);
    };
    try {
      for (let i = 1; i <= 100; i++)
        el.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId,
            clientX: start.x + i * 0.8,
            clientY: start.y + i * 0.4,
          }),
        );
      el.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId }),
      );
      return reads;
    } finally {
      paper.getBoundingClientRect = original;
    }
  }, start);
  await page.mouse.up();
  expect(reads).toBe(1);
  const position = async (axis: "left" | "top") =>
    picture.evaluate(
      (el, axis) => parseFloat(getComputedStyle(el)[axis]),
      axis,
    );
  await expect.poll(() => position("left")).toBeCloseTo(initial.x + 80, 2);
  await expect.poll(() => position("top")).toBeCloseTo(initial.y + 40, 2);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(() => position("left")).toBeCloseTo(initial.x, 2);
  await expect.poll(() => position("top")).toBeCloseTo(initial.y, 2);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect.poll(() => position("left")).toBeCloseTo(initial.x + 80, 2);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await page
    .locator(".free-object-name")
    .filter({ hasText: "校徽透明底" })
    .click();
  expect(
    Number(await page.getByLabel("元素 X 位置", { exact: true }).inputValue()),
  ).toBeCloseTo(initial.x + 80, 1);
  expect(
    Number(await page.getByLabel("元素 Y 位置", { exact: true }).inputValue()),
  ).toBeCloseTo(initial.y + 40, 1);
});

test("sidebar release, cancellation and mode changes dispose pending input without moving the header", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const handle = page.getByRole("separator", {
    name: "调整编辑区宽度",
    exact: true,
  });
  const header = page.getByRole("button", { name: "我的简历", exact: true });
  const initialHeader = (await header.boundingBox())!;
  const editor = page.locator(".editor-panel");
  const initialWidth = (await editor.boundingBox())!.width;
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await handle.evaluate((el, x) => {
    for (let i = 1; i <= 100; i++)
      el.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: x + i,
          bubbles: true,
        }),
      );
    el.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
    );
  }, x);
  await page.mouse.up();
  await expect
    .poll(async () => (await editor.boundingBox())!.width)
    .toBeCloseTo(initialWidth + 100, 0);
  expect((await header.boundingBox())!.x).toBe(initialHeader.x);

  // Queue an update and cancel it before paint. Later pointer events must be inert.
  const next = (await handle.boundingBox())!;
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2);
  await page.mouse.down();
  await handle.evaluate((el) => {
    el.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 900 }),
    );
    el.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    el.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 950 }),
    );
  });
  await page.mouse.up();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect
    .poll(async () => (await editor.boundingBox())!.width)
    .toBeCloseTo(initialWidth + 100, 0);
  await expect(
    page.getByRole("textbox", { name: "Markdown 简历内容", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  // The resize rail intentionally has zero visual width and a CSS hit area.
  await expect(handle).toBeAttached();
  await expect(
    page.getByRole("textbox", { name: "Markdown 简历内容", exact: true }),
  ).toBeVisible();
  expect((await header.boundingBox())!.x).toBe(initialHeader.x);
  expect(errors).toEqual([]);
});

test("holding a section reorders it once and undo restores all text", async ({
  page,
}) => {
  await page.goto("/");
  const sections = page.locator(".simple-editor .field-section");
  const original = await sections.allTextContents();
  const education = sections.filter({ hasText: "教育背景" });
  const internship = sections.filter({ hasText: "实习经历" });
  const from = (await internship.boundingBox())!;
  const to = (await education.boundingBox())!;
  const text = await page
    .getByRole("textbox", { name: "简单编辑内容", exact: true })
    .innerText();
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await expect(page.locator("body")).toHaveClass(/holding-block/);
  await page.mouse.move(to.x + 60, to.y + to.height / 2 - 3, { steps: 12 });
  await page.mouse.up();
  await expect(sections.first()).toContainText("实习经历");
  await expect(page.locator(".drop-target,.moving-block")).toHaveCount(0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(sections).toHaveText(original);
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: "简单编辑内容", exact: true })
        .innerText(),
    )
    .toBe(text);
});
