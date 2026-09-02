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
        
        // Get the fiber
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        // Traverse fiber tree to find ReactFlow instance
        let current = fiber;
        while (current) {
            // Check if this is the ReactFlow component
            if (current.memoizedProps && current.memoizedProps.onNodesChange) {
                // This is ReactFlow - get the instance from stateNode
                const stateNode = current.stateNode;
                if (stateNode) {
                    // Try to add a node
                    try {
                        stateNode.addNodes({
                            id: 'manual-test-node',
                            type: 'prompt',
                            position: { x: 300, y: 300 },
                            data: { label: 'Manual Test', type: 'prompt' }
                        });
                        
                        return {
                            success: true,
                            nodeCount: document.querySelectorAll('.react-flow__node').length
                        };
                    } catch (err) {
                        return { error: 'addNodes failed', message: err.message };
                    }
                }
            }
            current = current.return;
        }
        
        return { error: 'No ReactFlow found in fiber tree' };
    }""")
    
    print(f"Direct add via fiber: {json.dumps(result, indent=2)}")
    
    time.sleep(2)
    
    # Check nodes
    node_count = page.locator('.react-flow__node').count()
    print(f"Nodes after direct add: {node_count}")
    
    if node_count > 0:
        page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/manual_node_added.png', full_page=True)
    
    browser.close()
