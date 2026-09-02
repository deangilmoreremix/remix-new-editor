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
    
    page.goto('http://localhost:3000/')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(2)
    
    # Test imports in order
    tests = [
        ('src/types/timeline.js', 'timeline.js'),
        ('src/lib/workspace/workspace-context.jsx', 'workspace-context'),
        ('src/lib/workflows/node-registry.js', 'node-registry'),
        ('src/components/create/nodes/base-node.jsx', 'base-node'),
        ('src/components/create/nodes/prompt-node.jsx', 'prompt-node'),
        ('src/components/create/nodes/multi-prompt-node.jsx', 'multi-prompt-node'),
        ('src/components/create/nodes/storyboarder-node.jsx', 'storyboarder-node'),
        ('src/components/create/nodes/shot-board-node.jsx', 'shot-board-node'),
        ('src/components/create/nodes/music-prompt-node.jsx', 'music-prompt-node'),
        ('src/components/create/nodes/group-node.jsx', 'group-node'),
        ('src/components/create/nodes/model-node.jsx', 'model-node'),
        ('src/components/create/nodes/index.js', 'nodes-index'),
        ('src/components/create/node-palette.jsx', 'node-palette'),
        ('src/components/SpacesCanvas.jsx', 'SpacesCanvas'),
    ]
    
    for path, name in tests:
        print(f"\n--- Testing {name}: {path} ---")
        failed_before = len(failed_requests)
        result = page.evaluate("""async (path) => {
            try {
                const mod = await import(path);
                return { success: true, keys: Object.keys(mod).slice(0, 5) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }""", path)
        
        failed_after = len(failed_requests)
        new_failures = failed_requests[failed_before:]
        
        print(f"  Result: {result}")
        if new_failures:
            print(f"  New failures: {len(new_failures)}")
            for f in new_failures:
                print(f"    {f['status']} {f['url']}")
    
    # Save results
    with open('/tmp/import_test_results.json', 'w') as f:
        json.dump({
            'console_logs': console_logs,
            'failed_requests': failed_requests
        }, f, indent=2)
    
    browser.close()
