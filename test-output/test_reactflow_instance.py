from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Access ReactFlow via fiber
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        // Find the ReactFlow Wrapper component
        let current = fiber;
        while (current) {
            if (current.memoizedProps && 'nodes' in current.memoizedProps && 'edges' in current.memoizedProps) {
                // Found ReactFlow - try to get instance
                const stateNode = current.stateNode;
                if (stateNode) {
                    // Try to find the actual flow instance
                    const instanceKeys = Object.keys(stateNode).filter(k => typeof stateNode[k] === 'function');
                    return {
                        found: true,
                        stateNodeKeys: Object.keys(stateNode),
                        instanceKeys,
                        addNodes: typeof stateNode.addNodes,
                        getNodes: typeof stateNode.getNodes,
                        setNodes: typeof stateNode.setNodes
                    };
                }
            }
            current = current.return;
        }
        
        return { error: 'No ReactFlow found' };
    }""")
    
    print(f"ReactFlow instance: {json.dumps(result, indent=2)}")
    
    browser.close()
