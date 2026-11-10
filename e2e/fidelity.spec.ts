import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Fresh browser context and local fixtures only; never read a user's browser profile.
  await page.route("**/*", (route) =>
    /^https?:\/\/127\.0\.0\.1:5194\//.test(route.request().url()) ||
    route.request().url().startsWith("data:")
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
});

const tagGeometry = async (page: import("@playwright/test").Page) =>
  page
    .locator(".resume-paper")
    .first()
    .evaluate((paper) => {
      const root = paper.getBoundingClientRect(),
        scale = root.width / 794;
      return [...paper.querySelectorAll<HTMLElement>("code")].map((code) => {
        const r = code.getBoundingClientRect(),
          s = getComputedStyle(code);
        return {
          text: code.textContent,
          x: Math.round(((r.left - root.left) / scale) * 100) / 100,
          y: Math.round(((r.top - root.top) / scale) * 100) / 100,
          width: Math.round((r.width / scale) * 100) / 100,
          height: Math.round((r.height / scale) * 100) / 100,
          bg: s.backgroundColor,
          radius: s.borderRadius,
          padding: s.padding,
          font: s.font,
          fontSize: s.fontSize,
        };
      });
    });

test("all original chips and geometry survive a round trip without being converted to canvas text", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const before = await tagGeometry(page);
  expect(before.some((t) => t.text === "985")).toBe(true);
  expect(before.some((t) => t.text === "SpringBoot")).toBe(true);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-loading")).toHaveCount(0);
  await expect(page.locator(".free-source-paper .resume-paper")).toBeVisible();
  const free = await tagGeometry(page);
  expect(free).toEqual(before);
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  expect(await tagGeometry(page)).toEqual(before);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  expect(await tagGeometry(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("native canvas backing resolution follows zoom instead of scaling a bitmap with CSS", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper")).toBeVisible();
  await page
    .getByRole("button", { name: "100% 原始大小", exact: true })
    .click();
  const dimensions = await page
    .locator(".lower-canvas")
    .evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      css: el.getBoundingClientRect().width,
      dpr: devicePixelRatio,
      transform: getComputedStyle(el.parentElement!).transform,
    }));
  expect(dimensions.css).toBe(794);
  expect(dimensions.width).toBeCloseTo(794 * dimensions.dpr, 0);
  expect(dimensions.transform).toBe("none");
});

test("the complete paper is pixel-identical before and after switching, not just the text strings", async ({
  page,
}, testInfo) => {
  const capture = async (name: string) => {
    const style = await page.addStyleTag({
      content:
        ".studio .resume-paper,.free-source-paper>.resume-paper{position:fixed!important;left:0!important;top:0!important;transform:none!important;background:white!important;z-index:9999!important;}.paper-row.selected,.paper-row:hover,.paper-row:has([contenteditable=true]:focus){background:transparent!important;outline:none!important;box-shadow:none!important;}.app-header,.caret-word,.caret-bar,.moveable-control-box,.free-source-drag,.free-page-label{display:none!important;}",
    });
    const result = await page
      .locator(".resume-paper")
      .first()
      .screenshot({
        path: testInfo.outputPath(name + ".png"),
        animations: "disabled",
        caret: "hide",
      });
    await style.evaluate((el) => el.remove());
    return result;
  };
  const before = await capture("before");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper")).toBeVisible();
  const free = await capture("free");
  expect(free.equals(before)).toBe(true);
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  expect((await capture("markdown")).equals(before)).toBe(true);
});

test("dragging the original text uses shared geometry and undo, without replacing the text with a bitmap", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.locator(".free-source-paper .row-name").click();
  await expect(page.getByLabel("原稿 X 偏移", { exact: true })).toBeVisible();
  const handle = page.getByRole("button", {
      name: "拖动原稿元素",
      exact: true,
    }),
    box = await handle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 45,
    box!.y + box!.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("原稿 X 偏移", { exact: true }).inputValue(),
      ),
    )
    .toBeGreaterThan(20);
  const transform = await page
    .locator(".free-source-paper .paper-row")
    .first()
    .evaluate((el) => getComputedStyle(el).transform);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.locator(".resume-paper .paper-row").first()).toHaveCSS(
    "transform",
    transform,
  );
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator(".resume-paper .paper-row").first()).toHaveCSS(
    "transform",
    "none",
  );
});

test("editing source text and chip styling in free mode remains editable in Markdown and survives reload", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page
    .locator(".free-source-paper code")
    .filter({ hasText: "985" })
    .click();
  await expect(page.getByText("标签外观", { exact: true })).toBeVisible();
  await page.getByLabel("原稿边框宽度", { exact: true }).fill("2");
  await page.getByLabel("标签圆角", { exact: true }).fill("8");
  await page.getByLabel("标签内边距", { exact: true }).fill("4");
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  const chip = page.locator(".resume-paper code").filter({ hasText: "985" });
  await expect(chip).toHaveCSS("border-radius", "8px");
  await expect(chip).toHaveCSS("border-width", "2px");
  const md = page.getByLabel("Markdown 简历内容", { exact: true });
  const source = await md.inputValue();
  await md.fill(source.replace("# 炒肉多", "# 浏览器测试姓名"));
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper .row-name")).toHaveText(
    "浏览器测试姓名",
  );
  await expect(
    page.locator(".free-source-paper code").filter({ hasText: "985" }),
  ).toHaveCSS("border-radius", "8px");
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.locator(".resume-paper .row-name")).toHaveText(
    "浏览器测试姓名",
  );
  await expect(
    page.locator(".resume-paper code").filter({ hasText: "985" }),
  ).toHaveCSS("border-radius", "8px");
});

test("new icons and background rectangles remain visible through mode changes and save/reload", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).click();
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(
    page.locator(".resume-paper .free-layer-foreground svg"),
  ).toHaveCount(1);
  await expect(
    page.locator(".resume-paper .free-layer-background svg"),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  await expect(page.locator(".free-layer-background rect")).toHaveCount(1);
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(
    page.locator(".resume-paper .free-layer-background svg"),
  ).toHaveCount(1);
  await expect(
    page.locator(".resume-paper .free-layer-foreground svg"),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "圆形", exact: true }).click();
  await page.getByRole("button", { name: "自由模式撤销", exact: true }).click();
  await expect(page.locator('.free-message[role="alert"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.locator(".free-layer-background circle")).toHaveCount(0);
});

test("all six templates preserve their entire source DOM when opening free mode", async ({
  page,
}) => {
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
    const before = await tagGeometry(page);
    const title = await page
      .locator(".resume-paper .row-section")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return [
          s.backgroundColor,
          s.borderBottom,
          s.borderLeft,
          s.color,
          s.fontSize,
        ];
      });
    await page.getByRole("tab", { name: "自由模式", exact: true }).click();
    await expect(page.locator(".free-source-paper")).toBeVisible();
    expect(await tagGeometry(page), template).toEqual(before);
    expect(
      await page
        .locator(".resume-paper .row-section")
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return [
            s.backgroundColor,
            s.borderBottom,
            s.borderLeft,
            s.color,
            s.fontSize,
          ];
        }),
      template,
    ).toEqual(title);
    await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  }
});

test("source, local logo and shapes are included in both image exports", async ({
  page,
}, testInfo) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).click();
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  const { createCanvas } = await import("@napi-rs/canvas");
  const logo = createCanvas(40, 40);
  logo.getContext("2d").fillRect(0, 0, 40, 40);
  await page.locator(".free-studio input[type=file]").setInputFiles({
    name: "测试校徽.png",
    mimeType: "image/png",
    buffer: logo.toBuffer("image/png"),
  });
  await expect(
    page.getByRole("heading", { name: "图片设置", exact: true }),
  ).toBeVisible();
  for (const format of ["SVG", "PNG"]) {
    const pending = page.waitForEvent("download", { timeout: 60000 });
    await page
      .getByRole("button", { name: `本页 ${format}`, exact: true })
      .click();
    const download = await pending;
    const output = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(output);
    const fs = await import("node:fs/promises");
    const data = await fs.readFile(output);
    expect(data.length).toBeGreaterThan(10000);
    if (format === "SVG") {
      const svg = data.toString();
      expect(svg).toContain("SpringBoot");
      expect(svg).toContain("985");
      expect(svg).toContain("foreignObject");
      expect(svg).toContain("rect");
    } else {
      const { loadImage } = await import("@napi-rs/canvas");
      const image = await loadImage(data);
      expect(image.width).toBe(1588);
      expect(image.height).toBe(2246);
    }
    await expect(page.locator('.free-message[role="alert"]')).toHaveCount(0);
  }
});

test("custom paper dimensions are shared in all modes and restored on reload", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByLabel("自由纸张宽度", { exact: true }).fill("900");
  await expect(page.locator(".free-source-paper>.resume-paper")).toHaveCSS(
    "width",
    "900px",
  );
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await expect(page.locator(".resume-paper").first()).toHaveCSS(
    "width",
    "900px",
  );
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.locator(".resume-paper").first()).toHaveCSS(
    "width",
    "900px",
  );
});

test("mobile users can enter free mode, add an icon and return with source intact", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "添加 / 元素", exact: true }).click();
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).click();
  await page.getByRole("button", { name: "画布", exact: true }).click();
  await expect(page.locator(".free-source-paper .row-name")).toHaveText(
    "炒肉多",
  );
  const header = await page
    .locator(".app-header")
    .evaluate((el) => ({
      brand: el.querySelector(".brand")!.getBoundingClientRect().right,
      docs: el.querySelector(".doc-switch")!.getBoundingClientRect().left,
      docsRight: el.querySelector(".doc-switch")!.getBoundingClientRect().right,
      actions: el.querySelector(".header-actions")!.getBoundingClientRect()
        .left,
    }));
  expect(header.brand).toBeLessThanOrEqual(header.docs);
  expect(header.docsRight).toBeLessThanOrEqual(header.actions);
  await page.screenshot({ path: testInfo.outputPath("mobile-free.png") });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("PDF printing contains the original editable text plus decoration layers", async ({
  page,
}, testInfo) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.getByRole("button", { name: "插入邮箱图标", exact: true }).click();
  await page.evaluate(() => {
    window.print = () => {
      (window as any).__printReady = true;
    };
  });
  await page
    .locator(".free-right")
    .getByRole("button", { name: "导出 PDF", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__printReady))
    .toBe(true);
  await expect(page.locator(".free-print .row-name")).toHaveText("炒肉多");
  await expect(
    page.locator(".free-print code").filter({ hasText: "985" }),
  ).toHaveCSS("border-radius", "3px");
  await expect(
    page.locator(".free-print .free-layer-foreground svg"),
  ).toHaveCount(1);
  const pdf = await page.pdf({
    path: testInfo.outputPath("resume.pdf"),
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.toString("latin1")).toContain("/Type /Font");
  expect(pdf.toString("latin1")).toContain("/ToUnicode");
});

test("upgrading a previous free draft keeps an accessible editable archive", async ({
  page,
}, testInfo) => {
  await expect(page.getByRole("status").first()).toContainText("已保存");
  const fixture = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("diyjobresume.docs.v1")!);
    library.items[0].doc.freeform = {
      version: 1,
      source: "legacy",
      pages: [
        {
          id: "old-page",
          width: 794,
          height: 1123,
          background: "#ffffff",
          canvas: {
            objects: [
              {
                type: "Textbox",
                text: "保留的旧自由稿",
                left: 30,
                top: 30,
                width: 200,
                fontSize: 16,
              },
            ],
          },
        },
      ],
    };
    return JSON.stringify(library);
  });
  await page.addInitScript(
    (value) => localStorage.setItem("diyjobresume.docs.v1", value),
    fixture,
  );
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper")).toBeVisible();
  await page.getByRole("tab", { name: "简单编辑", exact: true }).click();
  await page.getByRole("button", { name: "文件", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载可编辑备份", exact: true })
    .click();
  const download = await pending,
    output = testInfo.outputPath("old-draft.json");
  await download.saveAs(output);
  const fs = await import("node:fs/promises"),
    doc = JSON.parse(await fs.readFile(output, "utf8"));
  expect(doc.freeformArchive.pages[0].canvas.objects[0].text).toBe(
    "保留的旧自由稿",
  );
  expect(doc.lines[0].text).toBe("炒肉多");
});

test("typing directly in the original paper edits the same source in every mode", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await page.locator(".free-source-paper .row-name").fill("原稿直接编辑");
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  expect(
    await page.getByLabel("Markdown 简历内容", { exact: true }).inputValue(),
  ).toContain("# 原稿直接编辑");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.locator(".free-source-paper .row-name")).toHaveText(
    "原稿直接编辑",
  );
});
