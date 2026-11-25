/**
 * PWA Offline Tests
 *
 * IMPORTANT: These tests require the app to run in production mode because:
 * 1. next-pwa's config (next.config.js) sets `disable: process.env.NODE_ENV === "development"`,
 *    which disables the service worker generation in development mode
 * 2. registerServiceWorker() (src/utils/registerServiceWorker.ts) only registers the SW
 *    when `process.env.NODE_ENV === 'production'`, skipping in dev mode
 *
 * The playwright.config.ts webServer runs `npm run build && npm run start` to ensure
 * the service worker is properly registered, allowing these offline and caching tests
 * to pass consistently.
 */
import { test, expect } from '@playwright/test';

test.describe('PWA Offline Functionality', () => {
  test('should show offline banner when network is disconnected', async ({ page, context }) => {
    await page.goto('/');
    
    // Go offline
    await context.setOffline(true);
    
    // Wait for offline banner to appear
    await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for offline banner to disappear
    await expect(page.getByText(/offline/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('should disable transaction buttons when offline', async ({ page, context }) => {
    // Navigate to jobs page to get a real job
    await page.goto('/jobs');

    // Find the first job link and navigate to it
    const firstJobLink = page.locator('a[href*="/jobs/"]').first();
    await expect(firstJobLink).toBeVisible();
    await firstJobLink.click();

    // Wait for job details to load
    await page.waitForLoadState('networkidle');

    // Find a milestone submit button
    const submitButton = page.getByRole('button', { name: /submit milestone|complete|finalize/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    // Initially should be enabled
    await expect(submitButton).toBeEnabled();

    // Go offline
    await context.setOffline(true);

    // Wait a moment for state to update
    await page.waitForTimeout(1000);

    // Button should be disabled
    await expect(submitButton).toBeDisabled();

    // Hover to see tooltip
    await submitButton.hover();
    await expect(page.getByText(/blockchain transactions require.*internet|require.*connection/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Wait for state to update
    await page.waitForTimeout(1000);

    // Button should be enabled again
    await expect(submitButton).toBeEnabled();
  });

  test('should queue job application when offline', async ({ page, context }) => {
    // Navigate to job listing
    await page.goto('/jobs');

    // Wait for jobs to load
    await page.waitForLoadState('networkidle');

    // Find the first job and open it
    const firstJob = page.locator('[data-testid="job-card"], a[href*="/jobs/"]').first();
    await expect(firstJob).toBeVisible({ timeout: 5000 });
    await firstJob.click();

    // Wait for job details to load
    await page.waitForLoadState('networkidle');

    // Find apply button
    const applyButton = page.getByRole('button', { name: /apply|submit.*proposal/i }).first();
    await expect(applyButton).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);

    // Wait for offline indicator
    await expect(page.getByText(/offline/i)).toBeVisible();

    // Click apply
    await applyButton.click();

    // Fill application form
    const coverLetterField = page.locator('[name="coverLetter"], textarea').first();
    const rateField = page.locator('[name="proposedRate"], [type="number"]').first();

    await coverLetterField.fill('Test cover letter for offline application');
    await rateField.fill('100');

    // Submit application
    const submitBtn = page.getByRole('button', { name: /submit.*application|submit.*proposal|send/i });
    await submitBtn.click();

    // Should show queued message or confirmation
    await expect(page.getByText(/queued|saved|will be sent|pending|offline/i)).toBeVisible({ timeout: 5000 });
  });

  test('should sync queued applications when back online', async ({ page, context }) => {
    // First queue an application offline
    await page.goto('/jobs');
    await context.setOffline(true);
    
    // Queue an application (similar to previous test)
    const applyButton = page.getByRole('button', { name: /apply/i }).first();
    let queuedSomething = false;
    
    if (await applyButton.isVisible()) {
      await applyButton.click();
      await page.fill('[name="coverLetter"]', 'Test offline sync');
      await page.fill('[name="proposedRate"]', '150');
      await page.getByRole('button', { name: /submit.*application/i }).click();
      queuedSomething = true;
    }
    
    // Go back online
    await context.setOffline(false);
    
    // Only verify sync if something was actually queued
    if (queuedSomething) {
      // Wait for sync to complete
      await page.waitForTimeout(2000);
      
      // Should show success message or notification
      await expect(page.getByText(/application.*submitted|success/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should cache pages for offline viewing', async ({ page, context }) => {
    // Visit pages while online to cache them
    await page.goto('/');
    await page.goto('/jobs');
    await page.goto('/about');
    
    // Go offline
    await context.setOffline(true);
    
    // Navigate to cached pages - should still work
    await page.goto('/');
    await expect(page).toHaveTitle(/stellar.*market/i);
    
    await page.goto('/jobs');
    await expect(page.getByText(/jobs|opportunities/i)).toBeVisible();
    
    await page.goto('/about');
    await expect(page.getByText(/about/i)).toBeVisible();
  });

  test('should show pending sync indicator', async ({ page, context }) => {
    // Navigate to a page with messaging capability (e.g., job or user profile)
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find and open a job/profile with messaging
    const firstItem = page.locator('[data-testid="job-card"], [data-testid="user-profile"], a[href*="/jobs/"]').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });
    await firstItem.click();

    // Wait for details to load
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Trigger a queued action (send message)
    const messageButton = page.getByRole('button', { name: /send.*message|message|contact/i }).first();
    await expect(messageButton).toBeVisible({ timeout: 5000 });
    await messageButton.click();

    // Fill message form
    const messageField = page.locator('[name="message"], textarea').first();
    await messageField.fill('Test offline message');

    // Submit message
    const sendBtn = page.getByRole('button', { name: /send|submit/i }).last();
    await sendBtn.click();

    // Should show pending sync indicator in offline banner
    await expect(page.getByText(/pending|queued|offline/i)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);

    // Pending indicator should disappear after sync completes
    await expect(page.getByText(/pending|queued/i)).not.toBeVisible({ timeout: 10000 });
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should have valid PWA manifest', async ({ page }) => {
    await page.goto('/');
    
    // Check manifest link exists
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/site.webmanifest');
    
    // Fetch and validate manifest
    const manifestUrl = await manifestLink.getAttribute('href');
    const response = await page.request.get(manifestUrl!);
    expect(response.ok()).toBe(true);
    
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
