from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Add nodes
    for i in range(4):
        page.mouse.click(960, 600)
        time.sleep(0.3)
        page.keyboard.press('Space')
        time.sleep(0.5)
        palette_items = page.locator('.np__item').all()
        if len(palette_items) > 0:
            palette_items[i % len(palette_items)].click(force=True)
            time.sleep(1.5)
    
    time.sleep(2)
    
    # Check ReactFlow state
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        const queue = [fiber];
        const visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            visited.add(current);
            
            if (current.memoizedProps && 'nodes' in current.memoizedProps && 'edges' in current.memoizedProps) {
                const nodes = current.memoizedProps.nodes || [];
                const edges = current.memoizedProps.edges || [];
                return {
                    nodeCount: nodes.length,
                    edgeCount: edges.length,
                    nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position }))
                };
            }
            
            if (current.child) queue.push(current.child);
            if (current.sibling) queue.push(current.sibling);
        }
        
        return { error: 'ReactFlow not found' };
    }""")
    
    print(f"Final state: {json.dumps(result, indent=2)}")
    
    # Check DOM
    dom_nodes = page.locator('.react-flow__node').all()
    print(f"DOM nodes: {len(dom_nodes)}")
    
    page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/final_state.png', full_page=True)
    
    browser.close()
