from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Check ReactFlow state
    flow_state = page.evaluate("""() => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return null;
        
        // Try to access ReactFlow internal state
        const nodes = flowWrapper.querySelectorAll('.react-flow__node');
        const edges = flowWrapper.querySelectorAll('.react-flow__edge');
        
        return {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            nodeTypes: Array.from(nodes).map(n => n.className),
            flowClasses: flowWrapper.className
        };
    }""")
    
    print(f"Flow state: {json.dumps(flow_state, indent=2)}")
    
    # Try adding a node and check immediately
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    print(f"Palette items: {len(palette_items)}")
    
    if len(palette_items) > 0:
        # Click first item
        palette_items[0].click(force=True)
        time.sleep(2)
        
        # Check again
        flow_state_after = page.evaluate("""() => {
            const nodes = document.querySelectorAll('.react-flow__node');
            const edges = document.querySelectorAll('.react-flow__edge');
            return {
                nodeCount: nodes.length,
                edgeCount: edges.length,
                nodeHTML: nodes.length > 0 ? nodes[0].innerHTML.substring(0, 200) : null
            };
        }""")
        
        print(f"Flow state after add: {json.dumps(flow_state_after, indent=2)}")
        
        # Check for any React errors in the page
        react_errors = page.evaluate("""() => {
            // Check if there's a React error overlay
            const errorOverlay = document.querySelector('[data-reactroot] [class*="error"]');
            return {
                hasErrorOverlay: !!errorOverlay,
                bodyHTML: document.body.innerHTML.substring(0, 500)
            };
        }""")
        
        print(f"React errors: {json.dumps(react_errors, indent=2)}")
    
    browser.close()
