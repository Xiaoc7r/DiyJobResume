import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";

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
  await expect(page.locator(".theme-swatches")).toHaveCount(0);
  await page.getByRole("button", { name: "主题颜色", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "主题调色板", exact: true });
  await expect(palette.locator(".theme-swatches button")).toHaveCount(12);
  await palette
    .getByRole("button", { name: "主题色：酒红", exact: true })
    .click();
  await expect(palette.getByLabel("主题 HEX", { exact: true })).toHaveValue(
    "#853c4b",
  );
  await palette.getByRole("button", { name: "关闭调色板" }).click();
  await page.getByRole("button", { name: "正文颜色", exact: true }).click();
  await expect(page.getByLabel("正文 HEX", { exact: true })).toHaveValue(
    "#171717",
  );
  await page.getByRole("button", { name: "关闭调色板" }).click();
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
    name: "上传校徽",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "确认添加" })).toBeDisabled();
  await expect(dialog.getByRole("link", { name: "查找校徽" })).toHaveAttribute(
    "href",
    "https://www.urongda.com/logos",
  );
  await dialog.getByLabel("校徽文件", { exact: true }).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("wrong"),
  });
  await expect(dialog.getByRole("alert")).toContainText("PNG");
  await dialog
    .getByLabel("校徽文件", { exact: true })
    .setInputFiles(path.resolve("src/assets/company.png"));
  await expect(dialog.getByRole("button", { name: "确认添加" })).toBeEnabled();
  expect(await crest.locator("img").getAttribute("src")).toBe(before.src);
  await page.screenshot({ path: "../toolbar-crest-desktop.png" });
  await dialog.getByRole("button", { name: "确认添加" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(crest).toHaveCount(1);
  expect(await crest.getAttribute("style")).toBe(before.style);
  expect(await crest.getAttribute("data-picture-id")).toBe(before.id);
  expect(await crest.locator("img").getAttribute("src")).not.toBe(before.src);
  await page.getByRole("button", { name: "上传证件照", exact: true }).click();
  const photo = page.getByRole("dialog", { name: "上传证件照", exact: true });
  await expect(photo).toBeVisible();
  const drop = await page.evaluateHandle(
    (bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], "photo.png", { type: "image/png" }),
      );
      return transfer;
    },
    [...readFileSync(path.resolve("src/assets/company.png"))],
  );
  await photo
    .locator(".crest-drop")
    .dispatchEvent("drop", { dataTransfer: drop });
  await expect(photo.getByRole("button", { name: "确认添加" })).toBeEnabled();
  await photo.getByRole("button", { name: "确认添加" }).click();
  await expect(
    page.locator('.floating-picture[aria-label^="证件照"]'),
  ).toHaveCount(1);
  await page.getByLabel("预览缩放", { exact: true }).fill("140");
  await page.getByRole("tab", { name: "自由模式", exact: true }).click();
  await expect(page.getByLabel("预览缩放", { exact: true })).toHaveValue("140");
  await expect(page.getByLabel("网格", { exact: true })).toBeChecked();
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
