from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Search entire React tree for ReactFlow
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const rootFiber = flowWrapper[fiberKey];
        
        // BFS to find ReactFlow
        const queue = [rootFiber];
        const visited = new Set();
        let reactFlowFiber = null;
        
        while (queue.length > 0) {
            const fiber = queue.shift();
            if (!fiber || visited.has(fiber)) continue;
            visited.add(fiber);
            
            // Check if this is ReactFlow
            if (fiber.memoizedProps && 
                'nodes' in fiber.memoizedProps && 
                'edges' in fiber.memoizedProps &&
                'onNodesChange' in fiber.memoizedProps) {
                reactFlowFiber = fiber;
                break;
            }
            
            // Add children to queue
            if (fiber.child) queue.push(fiber.child);
            if (fiber.sibling) queue.push(fiber.sibling);
            
            // Also check return
            if (fiber.return) queue.push(fiber.return);
        }
        
        if (!reactFlowFiber) {
            return { error: 'ReactFlow not found', visited: visited.size };
        }
        
        const stateNode = reactFlowFiber.stateNode;
        if (!stateNode) {
            return { found: true, error: 'No stateNode' };
        }
        
        return {
            found: true,
            stateNodeKeys: Object.keys(stateNode),
            addNodes: typeof stateNode.addNodes,
            getNodes: typeof stateNode.getNodes,
            setNodes: typeof stateNode.setNodes
        };
    }""")
    
    print(f"ReactFlow search result: {json.dumps(result, indent=2)}")
    
    browser.close()
