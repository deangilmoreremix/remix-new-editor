from playwright.sync_api import sync_playwright
import json
import time
import os

OUTPUT_DIR = '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

console_logs = []
page_errors = []

def handle_console_message(msg):
    entry = {
        'type': msg.type,
        'text': msg.text,
        'location': str(msg.location) if msg.location else None
    }
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:300]}")
    if msg.type == 'error':
        page_errors.append(entry)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    
    page.on("console", handle_console_message)
    
    # Navigate to spaces
    print("Navigating to /#/spaces...")
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    page.screenshot(path=f'{OUTPUT_DIR}/01_initial_spaces.png', full_page=True)
    print("Screenshot saved: 01_initial_spaces.png")
    
    # Check what's in the content area
    content_area = page.locator('#content-area')
    if content_area.count() > 0:
        content_html = content_area.inner_html()
        print(f"\nContent area HTML (first 500 chars): {content_html[:500]}")
        
        # Save full content HTML
        with open(f'{OUTPUT_DIR}/content_area.html', 'w') as f:
            f.write(content_html)
        print("Content area HTML saved")
    
    # Check if SpacesCanvas module loaded
    spaces_canvas_loaded = page.evaluate("""() => {
        // Check if the module was loaded by looking for the console log
        // We can't directly check this, but we can check for the canvas
        return {
            hasCanvas: document.querySelector('.cinegen-canvas') !== null,
            hasReactFlow: document.querySelector('.react-flow') !== null,
            hasSpacesCard: document.querySelector('.np') !== null,
            bodyText: document.body.innerText.substring(0, 200)
        }
    }""")
    
    print(f"\nPage state: {json.dumps(spaces_canvas_loaded, indent=2)}")
    
    # Try to check pageLoaders
    page_loaders_info = page.evaluate("""() => {
        // Access the router module's pageLoaders if possible
        try {
            // The router is imported in main.js, but not exposed globally
            // Let's check what modules are loaded
            const scripts = Array.from(document.querySelectorAll('script'));
            return {
                scriptCount: scripts.length,
                hasViteModule: window.__vite_is_initial_request === true
            }
        } catch(e) {
            return { error: e.message }
        }
    }""")
    
    print(f"\nPage loaders info: {json.dumps(page_loaders_info, indent=2)}")
    
    # Wait a bit more
    time.sleep(2)
    page.screenshot(path=f'{OUTPUT_DIR}/02_after_wait.png', full_page=True)
    
    # Save all console logs
    with open(f'{OUTPUT_DIR}/console_logs.json', 'w') as f:
        json.dump(console_logs, f, indent=2)
    print(f"\nConsole logs saved: {len(console_logs)} total messages")
    
    # Summary
    print("\n=== SUMMARY ===")
    print(f"Console errors: {len(page_errors)}")
    if page_errors:
        print("\n--- Console Errors ---")
        for err in page_errors:
            print(f"[{err['type']}] {err['text'][:300]}")
    
    browser.close()
