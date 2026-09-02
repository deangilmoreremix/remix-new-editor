from playwright.sync_api import sync_playwright
import json
import time

console_logs = []
failed_requests = []

def handle_console_message(msg):
    entry = {'type': msg.type, 'text': msg.text}
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:300]}")

def handle_response(response):
    if response.status >= 400:
        failed_requests.append({'url': response.url, 'status': response.status})
        print(f"Failed: {response.status} {response.url}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on("console", handle_console_message)
    page.on("response", handle_response)
    
    # Go to landing page first (clean context)
    print("Navigating to landing page...")
    page.goto('http://localhost:3000/')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(2)
    
    # Now try importing SpacesCanvas from landing page
    print("\nImporting SpacesCanvas from landing page...")
    result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/components/SpacesCanvas.jsx');
            return { success: true, keys: Object.keys(mod) };
        } catch (err) {
            return { success: false, error: err.message, stack: err.stack };
        }
    }""")
    
    print(f"Result: {result}")
    
    # Check for new failures
    new_failures = [f for f in failed_requests if 'SpacesCanvas' in f['url'] or 'timeline' in f['url']]
    print(f"\nRelevant failures: {len(new_failures)}")
    for f in new_failures:
        print(f"  {f['status']} {f['url']}")
    
    browser.close()
