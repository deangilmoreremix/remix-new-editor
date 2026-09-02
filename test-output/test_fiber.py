from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to access ReactFlow instance via React fiber
    result = page.evaluate("""async () => {
        try {
            const flowWrapper = document.querySelector('.react-flow');
            if (!flowWrapper) return { error: 'No flow wrapper' };
            
            // Access React internal props
            const reactProps = flowWrapper.__reactProps$6skf4i6jmok;
            if (!reactProps) return { error: 'No react props' };
            
            // The ReactFlow instance should be in the props or we can access it via the fiber
            const fiber = flowWrapper.__reactFiber$6skf4i6jmok;
            
            // Try to find the ReactFlow instance by traversing the fiber tree
            let current = fiber;
            while (current) {
                if (current.stateNode && typeof current.stateNode.addNodes === 'function') {
                    return {
                        found: true,
                        method: 'stateNode',
                        hasAddNodes: true
                    };
                }
                if (current.memoizedProps && typeof current.memoizedProps.onNodesChange === 'function') {
                    // This is likely the ReactFlow component
                    return {
                        found: true,
                        method: 'memoizedProps',
                        propsKeys: Object.keys(current.memoizedProps).slice(0, 20)
                    };
                }
                current = current.return;
            }
            
            return {
                fiberKeys: Object.keys(fiber).slice(0, 20),
                stateNodeKeys: fiber.stateNode ? Object.keys(fiber.stateNode).slice(0, 20) : null
            };
        } catch (err) {
            return { error: err.message, stack: err.stack };
        }
    }""")
    
    print(f"Fiber result: {json.dumps(result, indent=2)}")
    
    browser.close()
