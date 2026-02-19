import { test, expect } from "@playwright/test";

test.describe("ヒアリング → カリキュラム表示フロー", () => {
  test("ヒアリングページが正しく表示される", async ({ page }) => {
    await page.goto("/onboarding/hearing");

    // Progress indicator is visible
    await expect(page.getByText("Q1/5")).toBeVisible();

    // First AI question is shown
    await expect(
      page.getByText(/お仕事について教えてください/)
    ).toBeVisible();

    // Input area is visible
    await expect(
      page.getByRole("textbox", { name: "メッセージ入力" })
    ).toBeVisible();
  });

  test("質問に回答するとプログレスが進む", async ({ page }) => {
    await page.goto("/onboarding/hearing");

    // Answer first question
    const input = page.getByRole("textbox", { name: "メッセージ入力" });
    await input.fill("研究者をしています");
    await page.getByRole("button", { name: "メッセージを送信" }).click();

    // User message appears
    await expect(page.getByText("研究者をしています")).toBeVisible();

    // Progress advances to Q2
    await expect(page.getByText("Q2/5")).toBeVisible({ timeout: 5000 });
  });

  test("全5問に回答するとカリキュラムページへ遷移する", async ({ page }) => {
    await page.goto("/onboarding/hearing");

    const answers = [
      "研究者をしています",
      "メールで送り合っています",
      "聞いたことはありますが使ったことはありません",
      "論文のバージョン管理に使いたいです",
      "コマンドライン操作が少し不安です",
    ];

    for (const answer of answers) {
      const input = page.getByRole("textbox", { name: "メッセージ入力" });
      await input.fill(answer);
      await page.getByRole("button", { name: "メッセージを送信" }).click();
      // Wait for next question or completion
      await page.waitForTimeout(1000);
    }

    // Should navigate to curriculum page
    await page.waitForURL("**/onboarding/curriculum", { timeout: 10000 });
    await expect(
      page.getByText("あなた専用のカリキュラム")
    ).toBeVisible();
  });

  test("スキップボタンで確認ダイアログが表示される", async ({ page }) => {
    await page.goto("/onboarding/hearing");

    await page.getByRole("button", { name: /スキップ/ }).click();

    // Warning dialog appears
    await expect(
      page.getByText("ヒアリングをスキップしますか")
    ).toBeVisible();
    await expect(
      page.getByText(/概念理解なしに進むと/)
    ).toBeVisible();
  });

  test("スキップ確認でキャンセルすると元に戻る", async ({ page }) => {
    await page.goto("/onboarding/hearing");

    await page.getByRole("button", { name: /スキップ/ }).click();
    await page
      .getByRole("button", { name: "ヒアリングを続ける" })
      .click();

    // Dialog closes, still on hearing page
    await expect(page.getByText("Q1/5")).toBeVisible();
  });

  test("スキップ確認で進むとカリキュラムページへ遷移する", async ({
    page,
  }) => {
    await page.goto("/onboarding/hearing");

    await page.getByRole("button", { name: /スキップ/ }).click();
    await page
      .getByRole("button", { name: "スキップして進む" })
      .click();

    await page.waitForURL("**/onboarding/curriculum", { timeout: 5000 });
  });

  test("カリキュラムページで5ステップが表示される", async ({ page }) => {
    await page.goto("/onboarding/curriculum");

    await expect(
      page.getByText("あなた専用のカリキュラム")
    ).toBeVisible();

    // All 5 steps visible
    await expect(page.getByText("GitHubアカウント作成")).toBeVisible();
    await expect(page.getByText("リポジトリ作成")).toBeVisible();
    await expect(page.getByText("最初のコミット")).toBeVisible();
    await expect(page.getByText("プルリクエスト")).toBeVisible();
    await expect(page.getByText("CI/CDパイプライン")).toBeVisible();

    // Start button visible
    await expect(
      page.getByRole("button", { name: /このカリキュラムで学習を始める/ })
    ).toBeVisible();
  });
});
