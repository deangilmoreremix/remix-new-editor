import { test, expect } from '@playwright/test'

test.describe('SmartVideo Platform', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check if the main heading is visible
    await expect(page.locator('h1').first()).toBeVisible()

    // Check if navigation is present
    await expect(page.locator('nav')).toBeVisible()
  })

  test('should navigate to sign in when clicking auth button', async ({ page }) => {
    await page.goto('/')

    // Look for sign in / sign up button
    const authButton = page.locator('button, a').filter({ hasText: /sign in|sign up|get started/i }).first()
    if (await authButton.isVisible()) {
      await authButton.click()
      // Should show auth modal or redirect
      await expect(page.locator('[role="dialog"], .auth-modal, form')).toBeVisible({ timeout: 5000 })
    }
  })

  test('should load pricing page', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('should load blog page', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('should protect dashboard route (redirect when unauthenticated)', async ({ page }) => {
    await page.goto('/dashboard')
    // Should redirect to home or show auth modal
    const currentUrl = page.url()
    expect(currentUrl === '/' || currentUrl.includes('sign') || currentUrl === `${page.url()}dashboard`).toBeTruthy()
  })
})
