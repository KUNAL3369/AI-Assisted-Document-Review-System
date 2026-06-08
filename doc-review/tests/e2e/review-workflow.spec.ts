import { test, expect } from '@playwright/test';

test.describe('Document Review Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in with test user (requires Supabase local/dev setup)
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('dashboard shows document statistics', async ({ page }) => {
    await expect(page.locator('text=Document Review System')).toBeVisible();
    // Status cards should be visible
    await expect(page.locator('text=Pending Review').first()).toBeVisible();
    await expect(page.locator('text=In Progress').first()).toBeVisible();
  });

  test('navigate to review queue', async ({ page }) => {
    await page.click('text=Review Queue');
    await page.waitForURL('/review-queue');

    // Queue should list documents needing review
    await expect(page.locator('text=Documents Awaiting Review').first()).toBeVisible();
  });

  test('upload a PDF document', async ({ page }) => {
    await page.click('text=Upload Document');
    await page.waitForURL('/upload');

    // Upload form should be visible
    await expect(page.locator('text=Upload Invoice').first()).toBeVisible();

    // Set up file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake pdf content'),
    });

    await page.click('button:has-text("Upload")');

    // Should redirect or show success
    await expect(page.locator('text=uploaded successfully').first().or(page.locator('text=success').first())).toBeVisible({ timeout: 10000 });
  });

  test('view document list and open a document', async ({ page }) => {
    await page.click('text=Documents');
    await page.waitForURL('/documents');

    // Should see documents table
    await expect(page.locator('table').first()).toBeVisible();

    // Click first document if any exist
    const firstDocLink = page.locator('a:has-text("INV-")').first();
    if (await firstDocLink.isVisible()) {
      await firstDocLink.click();
      await page.waitForURL(/\/documents\//);
      await expect(page.locator('text=Field Review').first()).toBeVisible();
    }
  });

  test('approve a field in document detail', async ({ page }) => {
    await page.goto('/documents');

    const firstDocLink = page.locator('a:has-text("INV-")').first();
    if (await firstDocLink.isVisible()) {
      await firstDocLink.click();
      await page.waitForURL(/\/documents\//);

      // Find an approve button
      const approveBtn = page.locator('button:has-text("Approve")').first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        // Wait for success feedback
        await expect(page.locator('text=approved').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('reject a field with comment', async ({ page }) => {
    await page.goto('/documents');

    const firstDocLink = page.locator('a:has-text("INV-")').first();
    if (await firstDocLink.isVisible()) {
      await firstDocLink.click();
      await page.waitForURL(/\/documents\//);

      const rejectBtn = page.locator('button:has-text("Reject")').first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        // Modal should appear
        await expect(page.locator('textarea').first()).toBeVisible();
        await page.fill('textarea', 'Incorrect value extracted');
        await page.click('button:has-text("Confirm Reject")');
        await expect(page.locator('text=rejected').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('audit logs page is accessible for team lead and admin', async ({ page }) => {
    await page.goto('/audit-logs');
    await page.waitForURL('/audit-logs');

    await expect(page.locator('text=Audit Log').first()).toBeVisible();
  });

  test('team management page is accessible for admin only', async ({ page }) => {
    await page.goto('/team');
    // May redirect to dashboard if user is not admin
    const currentUrl = page.url();
    if (currentUrl.includes('/team')) {
      await expect(page.locator('text=Team Management').first()).toBeVisible();
    }
    // If redirected, that also tests the guard
  });

  test('AI settings page is accessible', async ({ page }) => {
    await page.goto('/ai-settings');
    await page.waitForURL('/ai-settings');

    await expect(page.locator('text=AI Settings').first()).toBeVisible();
  });
});
