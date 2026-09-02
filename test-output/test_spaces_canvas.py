from playwright.sync_api import sync_playwright
import json
import time
import os

OUTPUT_DIR = '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

console_logs = []
page_errors = []
network_requests = []
running_node_ids = set()

def handle_console_message(msg):
    entry = {
        'type': msg.type,
        'text': msg.text,
        'location': msg.location
    }
    console_logs.append(entry)
    print(f"Console [{msg.type}]: {msg.text[:200]}")
    if msg.type == 'error':
        page_errors.append(entry)

def handle_request(request):
    url = request.url
    if 'muapi' in url or 'generate' in url or 'api.' in url:
        network_requests.append({
            'url': url,
            'method': request.method,
            'resource_type': request.resource_type
        })
        print(f"Network: {request.method} {url[:150]}")

def handle_response(response):
    url = response.url
    if 'muapi' in url or 'generate' in url or 'api.' in url:
        print(f"Response: {response.status} {url[:150]}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    
    page.on("console", handle_console_message)
    page.on("request", handle_request)
    page.on("response", handle_response)
    
    # Navigate to spaces
    print("Navigating to /#/spaces...")
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    page.screenshot(path=f'{OUTPUT_DIR}/01_initial_spaces.png', full_page=True)
    print("Screenshot saved: 01_initial_spaces.png")
    
    # Check if canvas loaded
    canvas_loaded = page.locator('.cinegen-canvas').count() > 0 or page.locator('.react-flow').count() > 0
    print(f"Canvas loaded: {canvas_loaded}")
    
    # Open palette with Space key
    print("\nOpening node palette with Space key...")
    page.keyboard.press('Space')
    time.sleep(1)
    page.screenshot(path=f'{OUTPUT_DIR}/02_palette_open.png', full_page=True)
    print("Screenshot saved: 02_palette_open.png")
    
    # Get available nodes from palette
    palette_items = page.locator('.np__item').all()
    print(f"Palette items found: {len(palette_items)}")
    
    # Get text of all palette items
    item_texts = []
    for item in palette_items:
        text = item.inner_text()
        item_texts.append(text)
        print(f"  - {text}")
    
    # Save palette items
    with open(f'{OUTPUT_DIR}/palette_items.txt', 'w') as f:
        f.write('\n'.join(item_texts))
    
    # Test adding each node type
    node_types_to_test = []
    
    # Look for specific node types
    target_nodes = ['Shot Ideas', 'Storyboarder', 'Music Prompt', 'flux-dev', 'flux-2-max', 'Group']
    for target in target_nodes:
        for item in palette_items:
            text = item.inner_text()
            if target.lower() in text.lower():
                node_types_to_test.append((target, item))
                break
    
    print(f"\nNode types to test: {[n[0] for n in node_types_to_test]}")
    
    added_nodes = []
    
    for node_name, item in node_types_to_test:
        print(f"\n--- Adding {node_name} ---")
        page.keyboard.press('Space')
        time.sleep(0.5)
        
        # Re-query palette items
        palette_items = page.locator('.np__item').all()
        for pi in palette_items:
            if node_name.lower() in pi.inner_text().lower():
                pi.click()
                time.sleep(1)
                added_nodes.append(node_name)
                page.screenshot(path=f'{OUTPUT_DIR}/03_node_{node_name.replace(" ", "_")}.png', full_page=True)
                print(f"Added {node_name}")
                break
    
    # Close palette
    page.keyboard.press('Escape')
    time.sleep(0.5)
    
    # Wait for nodes to render
    time.sleep(2)
    page.screenshot(path=f'{OUTPUT_DIR}/04_all_nodes_added.png', full_page=True)
    print("\nScreenshot saved: 04_all_nodes_added.png")
    
    # Test node interactions
    print("\n--- Testing node interactions ---")
    
    # Try to select and drag a node
    nodes = page.locator('.react-flow__node').all()
    print(f"Nodes on canvas: {len(nodes)}")
    
    if len(nodes) > 0:
        # Test selecting first node
        first_node = nodes[0]
        first_node.click()
        time.sleep(0.5)
        page.screenshot(path=f'{OUTPUT_DIR}/05_node_selected.png', full_page=True)
        print("Node selected")
        
        # Test dragging
        box = first_node.bounding_box()
        if box:
            start_x = box['x'] + box['width'] / 2
            start_y = box['y'] + box['height'] / 2
            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(start_x + 200, start_y + 100, steps=10)
            page.mouse.up()
            time.sleep(0.5)
            page.screenshot(path=f'{OUTPUT_DIR}/06_node_dragged.png', full_page=True)
            print("Node dragged")
    
    # Test connecting nodes if we have multiple
    if len(nodes) >= 2:
        print("\nTesting node connection...")
        # Find handles
        handles = page.locator('.react-flow__handle').all()
        print(f"Handles found: {len(handles)}")
        
        if len(handles) >= 2:
            # Try to connect two handles
            handle1 = handles[0]
            handle2 = handles[1]
            
            box1 = handle1.bounding_box()
            box2 = handle2.bounding_box()
            
            if box1 and box2:
                page.mouse.move(box1['x'] + box1['width']/2, box1['y'] + box1['height']/2)
                page.mouse.down()
                page.mouse.move(box2['x'] + box2['width']/2, box2['y'] + box2['height']/2, steps=10)
                page.mouse.up()
                time.sleep(0.5)
                page.screenshot(path=f'{OUTPUT_DIR}/07_nodes_connected.png', full_page=True)
                print("Nodes connected")
    
    # Check for execution buttons
    print("\n--- Checking for execution UI ---")
    run_buttons = page.locator('button:has-text("Run"), button:has-text("Generate"), button:has-text("Plan"), [class*="run"], [class*="generate"]').all()
    print(f"Run/generate buttons found: {len(run_buttons)}")
    
    # Check for runningNodeIds in UI
    running_indicators = page.locator('[class*="running"], [class*="loading"], [class*="disabled"]').all()
    print(f"Running/loading indicators: {len(running_indicators)}")
    
    # Test execution if we have a run button
    if len(run_buttons) > 0:
        print("\nAttempting to trigger execution...")
        run_buttons[0].click()
        time.sleep(3)
        page.screenshot(path=f'{OUTPUT_DIR}/08_execution_triggered.png', full_page=True)
        print("Execution triggered")
        
        # Check console for execution logs
        exec_logs = [log for log in console_logs if 'running' in log['text'].lower() or 'execute' in log['text'].lower() or 'muapi' in log['text'].lower()]
        print(f"Execution-related console logs: {len(exec_logs)}")
        for log in exec_logs:
            print(f"  - {log['text'][:150]}")
    
    # Wait a bit more for any async operations
    time.sleep(3)
    page.screenshot(path=f'{OUTPUT_DIR}/09_final_state.png', full_page=True)
    print("\nScreenshot saved: 09_final_state.png")
    
    # Save console logs
    with open(f'{OUTPUT_DIR}/console_logs.json', 'w') as f:
        json.dump(console_logs, f, indent=2)
    print(f"\nConsole logs saved: {len(console_logs)} total messages")
    
    # Save network requests
    with open(f'{OUTPUT_DIR}/network_requests.json', 'w') as f:
        json.dump(network_requests, f, indent=2)
    print(f"Network requests saved: {len(network_requests)} requests")
    
    # Summary
    print("\n=== TEST SUMMARY ===")
    print(f"Nodes added: {added_nodes}")
    print(f"Console errors: {len(page_errors)}")
    print(f"Network requests: {len(network_requests)}")
    
    if page_errors:
        print("\n--- Console Errors ---")
        for err in page_errors:
            print(f"[{err['type']}] {err['text'][:200]}")
    
    browser.close()

print(f"\nTest outputs saved to: {OUTPUT_DIR}")
