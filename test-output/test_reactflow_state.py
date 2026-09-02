from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Check ReactFlow nodes prop
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        // Find ReactFlow fiber
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const rootFiber = flowWrapper[fiberKey];
        
        // Search for ReactFlow component
        const queue = [rootFiber];
        const visited = new Set();
        
        while (queue.length > 0) {
            const fiber = queue.shift();
            if (!fiber || visited.has(fiber)) continue;
            visited.add(fiber);
            
            // Check if this has nodes/edges props
            if (fiber.memoizedProps && 'nodes' in fiber.memoizedProps && 'edges' in fiber.memoizedProps) {
                const nodes = fiber.memoizedProps.nodes || [];
                const edges = fiber.memoizedProps.edges || [];
                return {
                    found: true,
                    nodeCount: nodes.length,
                    edgeCount: edges.length,
                    firstNode: nodes.length > 0 ? nodes[0] : null,
                    firstEdge: edges.length > 0 ? edges[0] : null
                };
            }
            
            if (fiber.child) queue.push(fiber.child);
            if (fiber.sibling) queue.push(fiber.sibling);
        }
        
        return { error: 'ReactFlow not found', visited: visited.size };
    }""")
    
    print(f"ReactFlow state: {json.dumps(result, indent=2)}")
    
    # Now add a node via palette
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    if len(palette_items) > 0:
        palette_items[0].click(force=True)
        time.sleep(2)
        
        # Check state again
        result_after = page.evaluate("""async () => {
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
                        firstNode: nodes.length > 0 ? { id: nodes[0].id, type: nodes[0].type } : null
                    };
                }
                
                if (fiber.child) queue.push(fiber.child);
                if (fiber.sibling) queue.push(fiber.sibling);
            }
            
            return { error: 'ReactFlow not found' };
        }""")
        
        print(f"ReactFlow state after add: {json.dumps(result_after, indent=2)}")
    
    browser.close()
