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
    
    # Try to import SpacesCanvas directly
    print("\nTrying to import SpacesCanvas directly...")
    import_result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/components/SpacesCanvas.jsx');
            return {
                success: true,
                hasSpacesCanvas: typeof mod.SpacesCanvas === 'function',
                keys: Object.keys(mod)
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                stack: err.stack
            };
        }
    }""")
    
    print(f"Import result: {json.dumps(import_result, indent=2)}")
    
    # Try to import router to check pageLoaders
    print("\nTrying to check router pageLoaders...")
    router_result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/lib/router.js');
            // pageLoaders is not exported, so we can't check it directly
            return {
                success: true,
                keys: Object.keys(mod),
                hasNavigate: typeof mod.navigate === 'function'
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    }""")
    
    print(f"Router import result: {json.dumps(router_result, indent=2)}")
    
    # Try to call navigate to spaces manually
    print("\nTrying to manually navigate to spaces...")
    nav_result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/lib/router.js');
            await mod.navigate('spaces');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }""")
    
    print(f"Manual navigate result: {json.dumps(nav_result, indent=2)}")
    time.sleep(2)
    
    page.screenshot(path=f'{OUTPUT_DIR}/03_after_manual_nav.png', full_page=True)
    
    # Check content area again
    content_html = page.evaluate("""() => {
        const content = document.querySelector('#content-area');
        return content ? content.innerHTML.substring(0, 500) : 'No content area';
    }""")
    print(f"\nContent area after manual nav: {content_html}")
    
    # Save all console logs
    with open(f'{OUTPUT_DIR}/console_logs_debug.json', 'w') as f:
        json.dump(console_logs, f, indent=2)
    print(f"\nConsole logs saved: {len(console_logs)} total messages")
    
    browser.close()
