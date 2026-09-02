from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Open palette
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    print(f"Palette items: {len(palette_items)}")
    
    if len(palette_items) > 0:
        # Select first item with keyboard
        palette_items[0].focus()
        time.sleep(0.2)
        page.keyboard.press('Enter')
        time.sleep(2)
        
        # Check state
        result = page.evaluate("""async () => {
            const flowWrapper = document.querySelector('.react-flow');
            if (!flowWrapper) return { error: 'no flow' };
            
            const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
            const rootFiber = flowWrapper[fiberKey];
            
            const queue = [rootFiber];
            const visited = new Set();
            
            while (queue.length > 0) {
                const fiber = queue.shift();
                if (!fiber || visited.has(fiber)) continue;
                visited.add(fiber);
                
                if (fiber.memoizedProps && 'nodes' in fiber.memoizedProps && 'edges' in fiber.memoizedProps) {
                    const nodes = fiber.memoizedProps.nodes || [];
                    const edges = fiber.memoizedProps.edges || [];
                    return {
                        found: true,
                        nodeCount: nodes.length,
                        edgeCount: edges.length,
                        firstNode: nodes.length > 0 ? { id: nodes[0].id, type: nodes[0].type, position: nodes[0].position } : null
                    };
                }
                
                if (fiber.child) queue.push(fiber.child);
                if (fiber.sibling) queue.push(fiber.sibling);
            }
            
            return { error: 'ReactFlow not found' };
        }""")
        
        print(f"State after Enter: {json.dumps(result, indent=2)}")
        
        # Check if palette is still open
        palette = page.locator('.np')
        print(f"Palette open after Enter: {palette.count() > 0}")
    
    browser.close()
