from playwright.sync_api import sync_playwright
import json
import time

console_logs = []
page_errors = []

def handle_console_message(msg):
    entry = {'type': msg.type, 'text': msg.text}
    console_logs.append(entry)
    if msg.type == 'error':
        page_errors.append(entry)
        print(f"Console [error]: {msg.text[:200]}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on("console", handle_console_message)
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Clear initial errors
    page_errors.clear()
    console_logs.clear()
    
    # Open palette and add a node
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    print(f"Palette items: {len(palette_items)}")
    
    if len(palette_items) > 0:
        # Click first item
        palette_items[0].click(force=True)
        time.sleep(2)
        
        # Check for new errors
        print(f"\nErrors after adding node: {len(page_errors)}")
        for err in page_errors:
            print(f"  [{err['type']}] {err['text'][:200]}")
        
        # Check if node appeared
        nodes = page.locator('.react-flow__node').all()
        print(f"Nodes on canvas: {len(nodes)}")
        
        # Get node HTML
        if len(nodes) > 0:
            node_html = nodes[0].inner_html()
            print(f"Node HTML (first 300 chars): {node_html[:300]}")
        else:
            # Check canvas content
            canvas_html = page.locator('.react-flow').inner_html()
            print(f"Canvas HTML (first 300 chars): {canvas_html[:300]}")
    
    page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/after_add_node.png', full_page=True)
    
    browser.close()
