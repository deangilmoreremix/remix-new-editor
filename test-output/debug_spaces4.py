from playwright.sync_api import sync_playwright
import json
import time
import os

OUTPUT_DIR = '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

console_logs = []
failed_requests = []

def handle_console_message(msg):
    entry = {
        'type': msg.type,
        'text': msg.text,
        'location': str(msg.location) if msg.location else None
    }
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:300]}")

def handle_response(response):
    if response.status >= 400:
        failed_requests.append({
            'url': response.url,
            'status': response.status,
            'status_text': response.status_text
        })
        print(f"Failed: {response.status} {response.url}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    
    page.on("console", handle_console_message)
    page.on("response", handle_response)
    
    # Navigate to spaces
    print("Navigating to /#/spaces...")
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try direct import
    print("\nTrying direct import...")
    import_result = page.evaluate("""async () => {
        try {
            const mod = await import('/src/components/SpacesCanvas.jsx');
            return { success: true, keys: Object.keys(mod) };
        } catch (err) {
            return { success: false, error: err.message, stack: err.stack };
        }
    }""")
    
    print(f"Import result: {json.dumps(import_result, indent=2)}")
    
    print(f"\nFailed requests: {len(failed_requests)}")
    for req in failed_requests:
        print(f"  {req['status']} {req['url']}")
    
    # Save all data
    with open(f'{OUTPUT_DIR}/failed_requests.json', 'w') as f:
        json.dump({
            'console_logs': console_logs,
            'failed_requests': failed_requests,
            'import_result': import_result
        }, f, indent=2)
    
    browser.close()
