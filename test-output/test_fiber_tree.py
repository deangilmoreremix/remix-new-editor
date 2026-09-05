from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Inspect React tree structure
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        // Map out the fiber tree
        function mapFiber(node, depth = 0) {
            if (!node || depth > 10) return null;
            
            const info = {
                depth,
                type: node.type,
                key: node.key,
                elementType: typeof node.type === 'string' ? node.type : (node.type?.name || node.type?.displayName || 'unknown'),
                hasStateNode: !!node.stateNode,
                stateNodeKeys: node.stateNode ? Object.keys(node.stateNode).slice(0, 10) : null,
                memoizedPropsKeys: node.memoizedProps ? Object.keys(node.memoizedProps).slice(0, 15) : null
            };
            
            const children = [];
            if (node.child) children.push(mapFiber(node.child, depth + 1));
            if (node.sibling) children.push(mapFiber(node.sibling, depth + 1));
            
            return { info, children };
        }
        
        const tree = mapFiber(fiber);
        return tree;
    }""")
    
    print(f"Fiber tree: {json.dumps(result, indent=2)}")
    
    browser.close()
