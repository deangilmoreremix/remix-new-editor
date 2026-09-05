from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to access ReactFlow instance and add node directly
    result = page.evaluate("""async () => {
        try {
            // Find ReactFlow instance
            const flowWrapper = document.querySelector('.react-flow');
            if (!flowWrapper) return { error: 'No flow wrapper' };
            
            // Try to get ReactFlow instance via internal property
            const reactFlowInstance = flowWrapper._reactFlowInstance;
            
            if (!reactFlowInstance) {
                // Try other ways to access it
                return {
                    hasFlowWrapper: true,
                    reactFlowInstance: null,
                    flowWrapperProps: Object.keys(flowWrapper).filter(k => k.startsWith('_') || k.includes('react')).slice(0, 20)
                };
            }
            
            // Add a node
            const node = {
                id: 'test-node-1',
                type: 'prompt',
                position: { x: 200, y: 200 },
                data: { label: 'Test Node', type: 'prompt' }
            };
            
            reactFlowInstance.addNodes(node);
            
            return {
                success: true,
                nodeCount: document.querySelectorAll('.react-flow__node').length
            };
        } catch (err) {
            return { error: err.message, stack: err.stack };
        }
    }""")
    
    print(f"Direct add result: {json.dumps(result, indent=2)}")
    
    time.sleep(2)
    
    # Check if node appeared
    node_count = page.locator('.react-flow__node').count()
    print(f"Nodes after direct add: {node_count}")
    
    if node_count > 0:
        page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/direct_node_added.png', full_page=True)
    
    browser.close()
