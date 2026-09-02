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
        
        # Step 2: Try to open Settings using JavaScript
        log("Trying to open Settings via JavaScript...")
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
        page.screenshot(path=f"{SCREENSHOT_DIR}/02-after-settings-click.png")
        log("Screenshot saved: 02-after-settings-click.png")
        
        # Try to find and fill muapi key input
        log("Looking for muapi key input...")
        muapi_input = page.locator('#settings-muapi-key, input[placeholder*="Muapi"], input[placeholder*="muapi"]').first
        if muapi_input.count() > 0:
            # Use force click to bypass backdrop
            muapi_input.click(force=True)
            muapi_input.fill(MUAPI_KEY)
            log("Filled muapi key")
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/03-muapi-key-filled.png")
            log("Screenshot saved: 03-muapi-key-filled.png")
            
            # Click save button using force click
            save_btn = page.locator('#settings-muapi-save, button:has-text("Save Muapi API Key"), button:has-text("Save Key")').first
            if save_btn.count() > 0:
                save_btn.click(force=True)
                log("Clicked save button with force")
                page.wait_for_timeout(3000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/04-after-save.png")
                log("Screenshot saved: 04-after-save.png")
                
                # Check if status changed
                status_text = page.evaluate("""
                    () => {
                        const status = document.querySelector('#settings-muapi-status');
                        return status ? status.textContent : 'status not found';
                    }
                """)
                log(f"Muapi status after save: {status_text}")
        else:
            log("Muapi key input not found - settings modal may not be open")
        
        # Try to set muapi key via JavaScript directly as fallback
        log("Setting muapi key via JavaScript as fallback...")
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
        
        # Close the modal by removing it from DOM
        log("Removing modal from DOM...")
        page.evaluate("""
            () => {
                // Remove all fixed overlays/modals
                const overlays = document.querySelectorAll('[class*="fixed inset-0"], [role="dialog"], [class*="modal"], [class*="backdrop"]');
                overlays.forEach(el => el.remove());
                
                // Also try to dispatch escape key event
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
        """)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/05-modal-closed.png")
        log("Screenshot saved: 05-modal-closed.png")
        
        # Step 3: Open node palette with Space key
        log("Opening node palette with Space key...")
        page.keyboard.press("Space")
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/06-palette-opened.png")
        log("Screenshot saved: 06-palette-opened.png")
        
        # Search for flux-dev
        log("Searching for flux-dev...")
        search_input = page.locator('input[class*="search"], input[class*="palette"], input[type="text"]').first
        if search_input.count() > 0:
            search_input.fill("flux-dev")
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/07-palette-flux-dev-search.png")
            log("Screenshot saved: 07-palette-flux-dev-search.png")
            
            # Select flux-dev
            flux_item = page.locator('text=flux-dev, [class*="flux-dev"]').first
            if flux_item.count() > 0:
                flux_item.click()
                page.wait_for_timeout(2000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/08-flux-dev-node-added.png")
                log("Screenshot saved: 08-flux-dev-node-added.png")
            else:
                log("flux-dev not found in palette")
        else:
            log("Palette search input not found")
        
    except Exception as e:
        print(f"[ERROR] Test failed with exception: {e}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/error.png")
    finally:
        browser.close()
