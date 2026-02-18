import { test, expect } from "@playwright/test";
import { TEST_USER, mockAuthAPI } from "./utils/auth";

test.describe("サインアップ → ログインフロー", () => {
  test("トップページが正しく表示される", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /自分でプロダクトを作れる/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "今すぐ始める" })
    ).toBeVisible();
  });

  test("ログインボタンでAuthModalが開く", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "ログイン" })
    ).toBeVisible();
  });

  test("サインアップフォームに切り替えられる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.getByRole("button", { name: "新規登録" }).click();

    await expect(
      page.getByRole("heading", { name: "アカウント作成" })
    ).toBeVisible();
    await expect(page.getByLabel("パスワード (確認)")).toBeVisible();
  });

  test("パスワード不一致でバリデーションエラーが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.getByRole("button", { name: "新規登録" }).click();

    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page
      .getByLabel("パスワード", { exact: true })
      .fill("password1");
    await page.getByLabel("パスワード (確認)").fill("password2");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("パスワードが一致しません")
    ).toBeVisible();
  });

  test("短すぎるパスワードでバリデーションエラーが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.getByRole("button", { name: "新規登録" }).click();

    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill("short");
    await page.getByLabel("パスワード (確認)").fill("short");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("パスワードは8文字以上")
    ).toBeVisible();
  });

  test("未入力でバリデーションエラーが表示される", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();
    // Switch to signup mode to get the "アカウントを作成" submit button
    await page.getByRole("button", { name: "新規登録" }).click();
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("メールアドレスとパスワードを入力してください")
    ).toBeVisible();
  });

  test("Googleログインボタンが表示される", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(
      page.getByRole("button", { name: /Google/ })
    ).toBeVisible();
  });

  test("「今すぐ始める」ボタンで未ログイン時にAuthModalが開く", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "今すぐ始める" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
