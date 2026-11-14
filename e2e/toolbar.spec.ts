import { test, expect } from "@playwright/test";
import path from "node:path";

test("compact shared zoom, direct theme colors, and staged crest replacement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText("预览大小", { exact: true })).toHaveCount(0);
  await expect(page.locator(".page-count")).toHaveCount(0);
  await expect(page.getByLabel("排版密度", { exact: true })).toHaveCount(0);
  const swatches = page.locator(".theme-swatches button");
  await expect(swatches).toHaveCount(12);
  const body = await page.getByLabel("正文颜色", { exact: true }).inputValue();
  await page.getByRole("button", { name: "主题色：酒红", exact: true }).click();
  await expect(page.getByLabel("主题颜色", { exact: true })).toHaveValue(
    "#853c4b",
  );
  expect(await page.getByLabel("正文颜色", { exact: true }).inputValue()).toBe(
    body,
  );
  await expect(
    page.getByRole("button", { name: "主题色：酒红", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "间距与字号", exact: true }).click();
  await expect(page.getByLabel("密度预设", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "关闭窗口", exact: true }).click();
  const crest = page.locator(".floating-picture:not([data-anchor])");
  const before = await crest.evaluate((el) => ({
    src: el.querySelector("img")!.src,
    style: el.getAttribute("style"),
    id: (el as HTMLElement).dataset.pictureId,
  }));
  await page.getByRole("button", { name: "上传校徽", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "为简历添上校徽",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "使用这张校徽" }),
  ).toBeDisabled();
  await dialog.getByLabel("搜索学校名称").fill("吉林大学");
  await expect(dialog.getByRole("link", { name: "查找校徽" })).toHaveAttribute(
    "href",
    /commons\.wikimedia\.org.*%E5%90%89/,
  );
  await dialog
    .getByLabel("校徽文件", { exact: true })
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("wrong"),
    });
  await expect(dialog.getByRole("alert")).toContainText("PNG");
  await dialog
    .getByLabel("校徽文件", { exact: true })
    .setInputFiles(path.resolve("src/assets/company.png"));
  await expect(
    dialog.getByRole("button", { name: "使用这张校徽" }),
  ).toBeEnabled();
  expect(await crest.locator("img").getAttribute("src")).toBe(before.src);
  await page.screenshot({ path: "../toolbar-crest-desktop.png" });
  await dialog.getByRole("button", { name: "使用这张校徽" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(crest).toHaveCount(1);
  expect(await crest.getAttribute("style")).toBe(before.style);
  expect(await crest.getAttribute("data-picture-id")).toBe(before.id);
  expect(await crest.locator("img").getAttribute("src")).not.toBe(before.src);
  // Photo keeps its existing one-click native upload flow.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "上传证件照", exact: true }).click();
  await (await chooser).setFiles([]);
  await expect(page.locator(".crest-dialog")).toHaveCount(0);
  await page.getByLabel("预览缩放", { exact: true }).fill("140");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("140");
  await expect(page.getByText("预览大小", { exact: true })).toHaveCount(0);
  await expect(page.locator(".page-count")).toHaveCount(0);
  await page.getByRole("button", { name: "缩小预览", exact: true }).click();
  await page.getByRole("tab", { name: "Markdown .md", exact: true }).click();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("130");
  await page.getByRole("button", { name: "上传校徽", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: "../toolbar-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "上传校徽", exact: true }).click();
  await expect(dialog).toBeVisible();
  const fits = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  });
  expect(fits).toBe(true);
  await page.screenshot({ path: "../toolbar-crest-mobile.png" });
  expect(errors).toEqual([]);
});
