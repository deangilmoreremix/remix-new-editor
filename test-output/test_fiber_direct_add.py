from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Access ReactFlow via fiber and add node
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        // Search for ReactFlow component in fiber tree
        const queue = [fiber];
        const visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            visited.add(current);
            
            // Check for ReactFlow props
            if (current.memoizedProps && 
                'nodes' in current.memoizedProps && 
                'edges' in current.memoizedProps &&
                'onNodesChange' in current.memoizedProps) {
                
                const stateNode = current.stateNode;
                if (stateNode) {
                    // Try to add node
                    try {
                        stateNode.addNodes({
                            id: 'manual-test-' + Date.now(),
                            type: 'prompt',
                            position: { x: 400, y: 400 },
                            data: { label: 'Manual Test', type: 'prompt' }
                        });
                        return { success: true, nodeCount: document.querySelectorAll('.react-flow__node').length };
                    } catch (err) {
                        return { error: 'addNodes failed', message: err.message };
                    }
                }
            }
            
            if (current.child) queue.push(current.child);
            if (current.sibling) queue.push(current.sibling);
        }
        
        return { error: 'ReactFlow not found in tree' };
    }""")
    
    print(f"Direct add result: {json.dumps(result, indent=2)}")
    
    time.sleep(2)
    
    # Check nodes
    node_count = page.locator('.react-flow__node').count()
    print(f"Nodes after add: {node_count}")
    
    if node_count > 0:
        page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/manual_node_via_fiber.png', full_page=True)
    
    browser.close()
