from playwright.sync_api import sync_playwright
import json
import time

console_logs = []
all_requests = []

def handle_console_message(msg):
    entry = {'type': msg.type, 'text': msg.text}
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:300]}")

def handle_request(request):
    all_requests.append({
        'url': request.url,
        'method': request.method,
        'resource_type': request.resource_type
    })

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on("console", handle_console_message)
    page.on("request", handle_request)
    
    page.goto('http://localhost:3000/')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(2)
    
    # Clear requests
    all_requests.clear()
    
    # Try importing a simple module
    print("Importing src/types/timeline.js...")
    result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/types/timeline.js');
            return { success: true, keys: Object.keys(mod) };
        } catch (err) {
            return { success: false, error: err.message, name: err.name };
        }
    }""")
    
    print(f"Result: {result}")
    print(f"\nRequests during import:")
    for req in all_requests:
        if 'timeline' in req['url'].lower() or 'vite' in req['url'].lower():
            print(f"  {req['method']} {req['url']}")
    
    browser.close()
