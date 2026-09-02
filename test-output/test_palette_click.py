from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Check initial state via React internals
    initial_state = page.evaluate("""() => {
        // Access workspace state through window if exposed
        return {
            hasWorkspaceContext: typeof window.__workspaceState !== 'undefined',
            nodeCount: document.querySelectorAll('.react-flow__node').length
        };
    }""")
    
    print(f"Initial state: {json.dumps(initial_state, indent=2)}")
    
    # Open palette and click item
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    print(f"Palette items: {len(palette_items)}")
    
    if len(palette_items) > 0:
        # Click first item
        palette_items[0].click(force=True)
        time.sleep(2)
        
        # Check state after click
        after_state = page.evaluate("""() => {
            return {
                nodeCount: document.querySelectorAll('.react-flow__node').length,
                edgeCount: document.querySelectorAll('.react-flow__edge').length,
                paletteOpen: document.querySelector('.np') !== null
            };
        }""")
        
        print(f"State after click: {json.dumps(after_state, indent=2)}")
        
        # Check for any errors in console
        console_errors = page.evaluate("""() => {
            // Try to access any global error state
            return {
                hasError: window.__reactError !== undefined,
                error: window.__reactError
            };
        }""")
        
        print(f"Console errors: {json.dumps(console_errors, indent=2)}")
    
    browser.close()
