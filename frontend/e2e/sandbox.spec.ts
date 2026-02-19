import { test, expect } from "@playwright/test";

test.describe("サンドボックス体験フロー", () => {
  test("サンドボックスページが正しく表示される", async ({ page }) => {
    await page.goto("/learn/sandbox");

    await expect(
      page.getByText("なぜGitが必要なのか、体験してみましょう")
    ).toBeVisible();
    await expect(page.getByText("ステップ 1/4")).toBeVisible();
    await expect(page.getByText("レポート.txt")).toBeVisible();
  });

  test("ステップ1: テキストを入力して保存できる", async ({ page }) => {
    await page.goto("/learn/sandbox");

    // Type in the editor
    const editor = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor.fill("これは最初のレポートです。重要な内容が含まれています。");

    // Save
    await page.getByRole("button", { name: /保存/ }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    // Next button becomes enabled
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText("ステップ 2/4")).toBeVisible();
  });

  test("ステップ2: 上書き保存後にステップ3へ進める", async ({ page }) => {
    await page.goto("/learn/sandbox");

    // Step 1
    const editor = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor.fill("バージョン1の内容");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 2
    await expect(page.getByText("ステップ 2/4")).toBeVisible();
    const editor2 = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor2.clear();
    await editor2.fill("バージョン2の内容 (全く違う文章)");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 3 - Loss demonstration
    await expect(page.getByText("ステップ 3/4")).toBeVisible();
    await expect(page.getByText(/元に戻せますか/)).toBeVisible();
  });

  test("ステップ3→ステップ4でGit復元デモが表示される", async ({ page }) => {
    await page.goto("/learn/sandbox");

    // Quick run through steps 1-2
    const editor = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor.fill("最初の内容");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    const editor2 = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor2.clear();
    await editor2.fill("上書きした内容");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 3 -> Step 4
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 4 - Git demo
    await expect(page.getByText("ステップ 4/4")).toBeVisible();
    await expect(page.getByText(/Gitがあれば/)).toBeVisible();
    await expect(page.getByText("Gitのバージョン履歴")).toBeVisible();
    await expect(page.getByText("バージョン 1")).toBeVisible();
    await expect(page.getByText("バージョン 2")).toBeVisible();
  });

  test("理解度チェックへ進むと質問が表示される", async ({ page }) => {
    await page.goto("/learn/sandbox");

    // Run through all demo steps quickly
    const editor = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor.fill("v1");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    const editor2 = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor2.clear();
    await editor2.fill("v2");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 3 next
    await page.getByRole("button", { name: "次へ" }).click();

    // Step 4 -> understanding question
    await page.getByRole("button", { name: "理解度チェックへ" }).click();

    // Understanding question page
    await expect(
      page.getByText("Gitが必要だと思いますか")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /はい、役立ちそう/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /まだわからない/ })
    ).toBeVisible();
  });

  test("理解度チェックで回答すると次へ進むボタンが有効になる", async ({
    page,
  }) => {
    await page.goto("/learn/sandbox");

    // Quick path to understanding question
    const editor = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor.fill("v1");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    const editor2 = page.getByRole("textbox", {
      name: /レポート.txtの内容を編集/,
    });
    await editor2.clear();
    await editor2.fill("v2");
    await page.getByRole("button", { name: /保存/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "理解度チェックへ" }).click();

    // Select "yes"
    await page
      .getByRole("button", { name: /はい、役立ちそう/ })
      .click();

    // Free text area appears
    await expect(
      page.getByText("どんな場面で使えそうですか")
    ).toBeVisible();

    // Next button is enabled
    await expect(
      page.getByRole("button", { name: "次へ進む" })
    ).toBeEnabled();
  });
});
