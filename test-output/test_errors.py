from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    # Set up global error capture BEFORE navigation
    page.evaluate("""() => {
        window.__reactErrors = [];
        window.__consoleErrors = [];
        
        // Capture console errors
        const originalConsoleError = console.error;
        console.error = function(...args) {
            window.__consoleErrors.push(args.join(' '));
            originalConsoleError.apply(console, args);
        };
        
        // Capture unhandled rejections
        window.addEventListener('unhandledrejection', (event) => {
            window.__reactErrors.push('Unhandled rejection: ' + event.reason);
        });
        
        // Capture global errors
        window.addEventListener('error', (event) => {
            window.__reactErrors.push('Global error: ' + event.message);
        });
    }""")
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Open palette and add node
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    print(f"Palette items: {len(palette_items)}")
    
    if len(palette_items) > 0:
        palette_items[0].click(force=True)
        time.sleep(3)
        
        # Check for errors
        errors = page.evaluate("""() => {
            return {
                consoleErrors: window.__consoleErrors || [],
                reactErrors: window.__reactErrors || []
            };
        }""")
        
        print(f"Console errors: {len(errors['consoleErrors'])}")
        for err in errors['consoleErrors'][:5]:
            print(f"  {err[:200]}")
        
        print(f"React errors: {len(errors['reactErrors'])}")
        for err in errors['reactErrors'][:5]:
            print(f"  {err[:200]}")
        
        # Check node count again
        node_count = page.locator('.react-flow__node').count()
        print(f"Nodes after add: {node_count}")
    
    browser.close()
