import { type Page, expect } from "@playwright/test";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const TEST_USER = {
  email: "e2e-test@gitpath.example.com",
  password: "TestPass123!",
  displayName: "E2E Test User",
};

/**
 * Sign up a new user via the AuthModal UI.
 */
export async function signUpViaUI(page: Page) {
  // Click login button in header to open AuthModal
  await page.getByRole("button", { name: "ログイン" }).click();

  // Switch to signup mode
  await page.getByRole("button", { name: "新規登録" }).click();

  // Fill form
  await page.getByLabel("メールアドレス").fill(TEST_USER.email);
  await page.getByLabel("パスワード", { exact: true }).fill(TEST_USER.password);
  await page.getByLabel("パスワード (確認)").fill(TEST_USER.password);

  // Submit
  await page.getByRole("button", { name: "アカウントを作成" }).click();
}

/**
 * Login via the AuthModal UI.
 */
export async function loginViaUI(page: Page) {
  await page.getByRole("button", { name: "ログイン" }).click();

  await page.getByLabel("メールアドレス").fill(TEST_USER.email);
  await page.getByLabel("パスワード", { exact: true }).fill(TEST_USER.password);

  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

/**
 * Mock the auth API responses so E2E tests work without a running backend.
 */
export async function mockAuthAPI(page: Page) {
  await page.route(`${API_BASE}/auth/**`, async (route) => {
    const url = route.request().url();

    if (url.includes("/auth/signup") || url.includes("/auth/login")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "test-user-id",
            email: TEST_USER.email,
            displayName: TEST_USER.displayName,
          },
          accessToken: "mock-access-token-for-e2e",
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Mock all backend API responses for offline E2E testing.
 */
export async function mockAllAPIs(page: Page) {
  await mockAuthAPI(page);

  // Mock hearing API
  await page.route(`${API_BASE}/hearing/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock sessions API
  await page.route(`${API_BASE}/sessions/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "mock-session-id",
        status: "active",
      }),
    });
  });

  // Mock certificates API
  await page.route(`${API_BASE}/certificates/**`, async (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/certificates\/(.+)$/);

    if (route.request().method() === "GET" && idMatch) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: idMatch[1],
          githubUsername: "test-user",
          elapsedSeconds: 1680,
          completedAt: new Date().toISOString(),
          milestoneDetails: [
            { name: "GitHubアカウント作成", completedAt: new Date().toISOString() },
            { name: "リポジトリ作成", completedAt: new Date().toISOString() },
            { name: "コミット", completedAt: new Date().toISOString() },
            { name: "プルリクエスト", completedAt: new Date().toISOString() },
            { name: "CI/CD", completedAt: new Date().toISOString() },
          ],
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        certificateId: "mock-cert-id",
        certificateUrl: "/certificate/mock-cert-id",
      }),
    });
  });
}

/**
 * Inject auth state into the page via Zustand store.
 */
export async function injectAuthState(page: Page) {
  await page.evaluate(() => {
    // Access Zustand store via window
    const store = (window as unknown as Record<string, unknown>);
    store.__ZUSTAND_AUTH__ = {
      user: {
        id: "test-user-id",
        email: "e2e-test@gitpath.example.com",
        displayName: "E2E Test User",
      },
      accessToken: "mock-access-token-for-e2e",
      isAuthenticated: true,
    };
  });
}
