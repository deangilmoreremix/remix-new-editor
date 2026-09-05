from playwright.sync_api import sync_playwright
import time

MUAPI_KEY = "ecb67239c65d1dbd277ba58451602111be50efa76afed7bab0649030353a4fb1"
BASE_URL = "http://localhost:3001/#/spaces"
SCREENSHOT_DIR = "/tmp/muapi-test-screenshots"

import os
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def log(msg):
    print(f"[TEST] {msg}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    
    try:
        # Step 1: Navigate to Spaces page
        log("Navigating to Spaces page...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01-spaces-page.png")
        log("Screenshot saved: 01-spaces-page.png")
        
        # Close any welcome modal
        log("Closing welcome modal if present...")
        # Try to find and click the X button
        x_btn = page.locator('button[class*="close"], .x, [aria-label="Close"]').first
        if x_btn.count() > 0:
            x_btn.click(force=True)
            page.wait_for_timeout(1000)
        else:
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
        
        # Step 2: Open Settings
        log("Opening Settings...")
        # Try clicking the Settings icon in sidebar
        settings_icon = page.locator('button[title="Settings"], button[aria-label="Settings"], #openSettings').first
        if settings_icon.count() > 0:
            settings_icon.click()
        else:
            # Try pressing comma key
            page.keyboard.press(",")
            page.wait_for_timeout(1000)
        
        page.screenshot(path=f"{SCREENSHOT_DIR}/02-settings-opened.png")
        log("Screenshot saved: 02-settings-opened.png")
        
        # Enter Muapi API key
        log("Entering Muapi API key...")
        muapi_input = page.locator('#settings-muapi-key').first
        if muapi_input.count() > 0:
            muapi_input.fill(MUAPI_KEY)
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/03-muapi-key-filled.png")
            log("Screenshot saved: 03-muapi-key-filled.png")
            
            # Click Save
            save_btn = page.locator('#settings-muapi-save').first
            if save_btn.count() > 0:
                save_btn.click(force=True)
                page.wait_for_timeout(2000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/04-after-save.png")
                log("Screenshot saved: 04-after-save.png")
        
        # Close settings
        log("Closing settings...")
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)
        
        # Step 3: Open node palette with Space key
        log("Opening node palette...")
        page.keyboard.press("Space")
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/05-palette-opened.png")
        log("Screenshot saved: 05-palette-opened.png")
        
        # Step 4: Search for flux-dev
        log("Searching for flux-dev...")
        search_input = page.locator('input[class*="search"], input[class*="palette"]').first
        if search_input.count() > 0:
            search_input.fill("flux-dev")
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/06-palette-flux-dev-search.png")
            log("Screenshot saved: 06-palette-flux-dev-search.png")
            
            # Select flux-dev
            flux_item = page.locator('text=flux-dev').first
            if flux_item.count() > 0:
                flux_item.click()
                page.wait_for_timeout(2000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/07-flux-dev-added.png")
                log("Screenshot saved: 07-flux-dev-added.png")
            else:
                log("flux-dev not found in palette")
        else:
            log("Palette search input not found")
        
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/error.png")
    finally:
        browser.close()
