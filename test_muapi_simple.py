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
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01-spaces-page-initial.png")
        log("Screenshot saved: 01-spaces-page-initial.png")
        
        # Close any open overlays/modals first
        log("Closing any open overlays...")
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)
        
        # Step 2: Try to open Settings using keyboard shortcut
        log("Trying to open Settings with keyboard shortcut...")
        # Try common settings shortcuts
        for shortcut in [",", "Ctrl+,"]:
            try:
                page.keyboard.press(shortcut)
                page.wait_for_timeout(1000)
                # Check if settings modal appeared
                if page.locator('[id*="settings"], [class*="settings"]').count() > 0:
                    log(f"Settings opened with shortcut: {shortcut}")
                    break
            except:
                continue
        
        page.screenshot(path=f"{SCREENSHOT_DIR}/02-after-settings-attempt.png")
        log("Screenshot saved: 02-after-settings-attempt.png")
        
        # Try clicking Settings in sidebar using JavaScript
        log("Trying to click Settings via JavaScript...")
        page.evaluate("""
            () => {
                const settingsBtn = Array.from(document.querySelectorAll('span, button, a'))
                    .find(el => el.textContent?.trim() === 'Settings' || el.textContent?.trim() === 'SETTINGS');
                if (settingsBtn) {
                    settingsBtn.click();
                    return 'clicked';
                }
                return 'not found';
            }
        """)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03-after-js-settings-click.png")
        log("Screenshot saved: 03-after-js-settings-click.png")
        
        # Try to find and fill muapi key input
        log("Looking for muapi key input...")
        muapi_input = page.locator('#settings-muapi-key, input[placeholder*="Muapi"], input[placeholder*="muapi"]').first
        if muapi_input.count() > 0:
            muapi_input.fill(MUAPI_KEY)
            log("Filled muapi key")
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04-muapi-key-filled.png")
            log("Screenshot saved: 04-muapi-key-filled.png")
            
            # Click save button using JavaScript
            log("Clicking save button via JavaScript...")
            page.evaluate("""
                () => {
                    const saveBtn = Array.from(document.querySelectorAll('button'))
                        .find(b => b.textContent?.includes('Save Muapi API Key') || b.textContent?.includes('Save Key'));
                    if (saveBtn) {
                        saveBtn.click();
                        return 'clicked';
                    }
                    return 'not found';
                }
            """)
            log("Clicked save button via JavaScript")
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/05-after-save.png")
            log("Screenshot saved: 05-after-save.png")
        else:
            log("Muapi key input not found - settings modal may not be open")
        
        # Try to set muapi key via JavaScript directly
        log("Setting muapi key via JavaScript...")
        result = page.evaluate(f"""
            () => {{
                localStorage.setItem('muapi_key', '{MUAPI_KEY}');
                localStorage.setItem('muapi_key_hash', 'test-hash');
                return {{
                    muapi_key: localStorage.getItem('muapi_key'),
                    muapi_key_hash: localStorage.getItem('muapi_key_hash')
                }};
            }}
        """)
        log(f"LocalStorage result: {result}")
        
        # Check if apiKeyManager is available
        api_manager = page.evaluate("""
            () => {
                if (window.apiKeyManager) {
                    return {
                        hasMuapiKey: window.apiKeyManager.hasMuapiKey ? window.apiKeyManager.hasMuapiKey() : 'method not found',
                        getMuapiKey: window.apiKeyManager.getMuapiKey ? window.apiKeyManager.getMuapiKey() : 'method not found'
                    };
                }
                return 'apiKeyManager not found';
            }
        """)
        log(f"API Manager state: {api_manager}")
        
        # Take final screenshot
        page.screenshot(path=f"{SCREENSHOT_DIR}/06-final-state.png")
        log("Screenshot saved: 06-final-state.png")
        
    except Exception as e:
        print(f"[ERROR] Test failed with exception: {e}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/error.png")
    finally:
        browser.close()
