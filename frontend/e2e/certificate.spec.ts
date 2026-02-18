import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./utils/auth";

test.describe("達成証明ページ表示 (公開URL)", () => {
  test("証明書ページが正しく表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    // Header
    await expect(page.getByText("Git学習 達成証明")).toBeVisible();
    await expect(
      page.getByText("GitPath Completion Certificate")
    ).toBeVisible();
  });

  test("GitHubユーザー名が表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    await expect(page.getByText("test-user")).toBeVisible();
  });

  test("全5マイルストーンが達成済みで表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    const milestoneNames = [
      "GitHubアカウント作成",
      "リポジトリ作成",
      "コミット",
      "プルリクエスト",
      "CI/CD",
    ];

    for (const name of milestoneNames) {
      await expect(page.getByText(name)).toBeVisible();
    }

    // All show "達成" badge
    const badges = page.getByText("達成");
    await expect(badges).toHaveCount(5);
  });

  test("完走時間が表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    await expect(page.getByText("完走時間")).toBeVisible();
    // 1680 seconds = 28 minutes
    await expect(page.getByText("28分")).toBeVisible();
  });

  test("達成日時が表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    await expect(page.getByText("達成日時")).toBeVisible();
  });

  test("Certificate IDが表示される", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/certificate/test-cert-id");

    await expect(
      page.getByText("Certificate ID: test-cert-id")
    ).toBeVisible();
  });

  test("認証なしでアクセスできる (公開ページ)", async ({ page }) => {
    await mockAllAPIs(page);
    // No auth setup - should still work
    await page.goto("/certificate/test-cert-id");

    await expect(page.getByText("Git学習 達成証明")).toBeVisible();
  });

  test("存在しない証明書は404表示になる", async ({ page }) => {
    // Override mock to return 404
    await page.route("**/certificates/**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Certificate not found" }),
      });
    });

    await page.goto("/certificate/nonexistent-id");

    await expect(page.getByText("証明書が見つかりません")).toBeVisible();
  });
});
