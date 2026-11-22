import { test, expect } from "@playwright/test";

test("zoom and grid changes reuse the canvas model and vector DOM; QQ is a penguin", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "插入QQ图标", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".free-front-scene svg image")).toHaveCount(4);
  await expect(page.getByRole("status").first()).toContainText("已保存");
  const names = await page
    .locator(".free-icons button")
    .evaluateAll((nodes) => nodes.map((el) => el.getAttribute("aria-label")));
  expect(names[9]).toBe("插入Gitee图标");
  expect(names.at(-1)).toBe("插入作品集图标");
  await page.evaluate(() => {
    const win = window as any;
    win.previewCounters = {
      clones: 0,
      serializations: 0,
      layerWrites: 0,
      imageReads: 0,
    };
    const src = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    )!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...src,
      get() {
        const value = src.get!.call(this) as string;
        if (value.startsWith("data:image/")) win.previewCounters.imageReads++;
        return value;
      },
    });
    const clone = structuredClone,
      stringify = JSON.stringify;
    window.structuredClone = ((value: any, ...args: any[]) => {
      if (value?.pages && value.version === 1) win.previewCounters.clones++;
      return clone(value, ...args);
    }) as typeof structuredClone;
    JSON.stringify = ((value: any, ...args: any[]) => {
      if (value?.pages && value.version === 1)
        win.previewCounters.serializations++;
      return (stringify as any)(value, ...args);
    }) as typeof JSON.stringify;
    const observer = new MutationObserver(
      (records) => (win.previewCounters.layerWrites += records.length),
    );
    document
      .querySelectorAll(".free-back-scene,.free-front-scene")
      .forEach((node) => observer.observe(node, { childList: true }));
    win.previewObserver = observer;
  });
  for (const zoom of ["110", "120", "100"]) {
    await page.getByLabel("预览缩放", { exact: true }).fill(zoom);
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .locator(".free-canvas-host canvas.lower-canvas")
            .evaluate((el) => el.getBoundingClientRect().width)) -
            (794 * Number(zoom)) / 100,
        ),
      )
      .toBeLessThan(0.03);
  }
  await page.getByText("网格", { exact: true }).click();
  await page.getByText("网格", { exact: true }).click();
  expect(await page.evaluate(() => (window as any).previewCounters)).toEqual({
    clones: 0,
    serializations: 0,
    layerWrites: 0,
    imageReads: 0,
  });
  await page.getByRole("button", { name: "插入QQ图标", exact: true }).click();
  await page.getByRole("button", { name: /^画布元素/ }).click();
  await expect(page.locator(".free-object-name").first()).toHaveText("QQ");
  await expect(page.locator(".free-front-scene ellipse")).toHaveCount(2);
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(page.locator(".free-layer-foreground ellipse")).toHaveCount(2);
});

test("theme reveal retains clipped scrolled sheets in every mode without promoting paper snapshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const mode of ["简单编辑", "Markdown", "自由模式", "模板制造"]) {
    await page.getByRole("tab", { name: mode, exact: true }).click();
    const workspace = page.locator(
      mode === "自由模式" || mode === "模板制造"
        ? ".free-canvas-scroll"
        : ".paper-workspace",
    );
    await expect(workspace).toBeVisible();
    await workspace.evaluate((el) => (el.scrollTop = 320));
    const before = await workspace.evaluate((el) => ({
      scroll: el.scrollTop,
      html: el.querySelector(".resume-paper")!.innerHTML,
    }));
    // Capture native snapshot setup, before an animation can finish.
    await page.evaluate(() => {
      const win = window as any;
      if (!document.startViewTransition || win.originalTransition) return;
      win.originalTransition = document.startViewTransition.bind(document);
      document.startViewTransition = ((...args: any[]) => {
        win.paperSnapshots = [
          ...document.querySelectorAll<HTMLElement>(".resume-paper"),
        ].map((el) => el.style.viewTransitionName);
        return win.originalTransition(...args);
      }) as typeof document.startViewTransition;
    });
    await page.getByRole("button", { name: "夜间模式", exact: true }).click();
    await expect(page.locator(".studio")).toHaveClass(/is-dark/);
    expect(await workspace.evaluate((el) => el.scrollTop)).toBe(before.scroll);
    expect(await workspace.locator(".resume-paper").first().innerHTML()).toBe(
      before.html,
    );
    expect(
      await page.evaluate(() =>
        ((window as any).paperSnapshots || []).every(
          (name: string) => name === "",
        ),
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState !== "finished" &&
                  (a.effect as KeyframeEffect)?.pseudoElement?.includes(
                    "view-transition",
                  ),
              ).length,
        ),
      )
      .toBe(0);
    if (mode === "简单编辑")
      await page.screenshot({ path: "../lean-scrolled-dark.png" });
    await page.getByRole("button", { name: "夜间模式", exact: true }).click();
    await expect(page.locator(".studio")).not.toHaveClass(/is-dark/);
  }
  expect(errors).toEqual([]);
});
