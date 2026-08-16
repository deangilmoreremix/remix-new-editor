from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    # Navigate to the edit page
    page.goto('http://localhost:3000/#/edit')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    
    # Close any open settings/API modal if present
    close_btn = page.locator('button[aria-label="Close"], .modal-close, [data-modal-id] button:has-text("×"), [data-modal-id] button:has-text("✕")')
    if close_btn.count() > 0:
        try:
            close_btn.first.click(timeout=2000)
            page.wait_for_timeout(500)
        except Exception:
            pass
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)
    
    # Scroll down to find thumbnail button
    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    page.wait_for_timeout(1000)
    
    # Take screenshot of the page before opening modal
    page.screenshot(path='/tmp/edit-studio-page.png', full_page=True)
    print("Screenshot saved: edit-studio-page.png")
    
    # Debug: find thumbnail button and scroll to it
    thumb_btn = page.locator('button:has-text("Thumbnail")')
    if thumb_btn.count() > 0:
        print(f"Found thumbnail button, visible: {thumb_btn.first.is_visible()}")
        # Scroll into view
        try:
            thumb_btn.first.scroll_into_view_if_needed(timeout=5000)
            page.wait_for_timeout(500)
            page.screenshot(path='/tmp/edit-studio-scrolled.png', full_page=True)
            print("Screenshot saved: edit-studio-scrolled.png")
        except Exception as e:
            print(f"Scroll failed: {e}")
        
        # Try clicking via JS if regular click fails
        try:
            thumb_btn.first.click(timeout=5000)
        except Exception as e:
            print(f"Regular click failed: {e}")
            page.evaluate('''() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent.includes('Thumbnail'));
                if (btn) btn.click();
            }''')
        
        page.wait_for_timeout(1500)
        page.screenshot(path='/tmp/thumbnail-modal-brief.png', full_page=True)
        print("Screenshot saved: thumbnail-modal-brief.png")
        
        # Click advanced toggle if visible
        advanced = page.locator('#thumb-panel-advanced-toggle')
        if advanced.count() > 0:
            advanced.first.click()
            page.wait_for_timeout(500)
            page.screenshot(path='/tmp/thumbnail-modal-advanced.png', full_page=True)
            print("Screenshot saved: thumbnail-modal-advanced.png")
        
        # Take a focused screenshot of just the modal
        modal = page.locator('.studio-thumb-panel')
        if modal.count() > 0:
            modal.first.screenshot(path='/tmp/thumbnail-modal-focused.png')
            print("Screenshot saved: thumbnail-modal-focused.png")
    else:
        print("Thumbnail button not found")
        buttons = page.locator('button').all()
        print(f"Found {len(buttons)} buttons")
        for btn in buttons[:30]:
            text = btn.inner_text()
            if text.strip():
                try:
                    vis = btn.is_visible()
                except Exception:
                    vis = 'err'
                print(f"  [{vis}] Button: {text.strip()[:50]}")
    
    browser.close()
