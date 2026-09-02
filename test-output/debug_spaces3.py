from playwright.sync_api import sync_playwright
import json
import time
import os

OUTPUT_DIR = '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

console_logs = []
network_requests = []

def handle_console_message(msg):
    entry = {
        'type': msg.type,
        'text': msg.text,
        'location': str(msg.location) if msg.location else None
    }
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:300]}")

def handle_request(request):
    if 'SpacesCanvas' in request.url or 'router' in request.url.lower():
        network_requests.append({
            'url': request.url,
            'method': request.method,
            'resource_type': request.resource_type
        })
        print(f"Network request: {request.method} {request.url}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    
    page.on("console", handle_console_message)
    page.on("request", handle_request)
    
    # Navigate to spaces
    print("Navigating to /#/spaces...")
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try direct import with detailed error capture
    print("\nTrying direct import...")
    import_details = page.evaluate("""async () => {
        const details = { steps: [] };
        try {
            details.steps.push('Starting import');
            const mod = await import('/src/components/SpacesCanvas.jsx');
            details.steps.push('Import succeeded');
            details.hasSpacesCanvas = typeof mod.SpacesCanvas === 'function';
            details.keys = Object.keys(mod);
            return details;
        } catch (err) {
            details.steps.push('Import failed: ' + err.message);
            details.error = err.message;
            details.stack = err.stack;
            details.name = err.name;
            return details;
        }
    }""")
    
    print(f"Import details: {json.dumps(import_details, indent=2)}")
    
    # Also try loading a simpler module to verify imports work
    print("\nTrying simple module import...")
    simple_import = page.evaluate("""async () => {
        try {
            const mod = await import('/src/lib/router.js');
            return { success: true, keys: Object.keys(mod) };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }""")
    
    print(f"Simple import: {json.dumps(simple_import, indent=2)}")
    
    # Check the actual network request for SpacesCanvas
    print(f"\nNetwork requests for SpacesCanvas/router: {len(network_requests)}")
    for req in network_requests:
        print(f"  {req['method']} {req['url']}")
    
    # Save logs
    with open(f'{OUTPUT_DIR}/console_network.json', 'w') as f:
        json.dump({
            'console_logs': console_logs,
            'network_requests': network_requests
        }, f, indent=2)
    
    browser.close()
