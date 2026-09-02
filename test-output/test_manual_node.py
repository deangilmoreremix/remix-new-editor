from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to manually add a node via ReactFlow API
    result = page.evaluate("""async () => {
        try {
            // Import the node registry
            const registry = await import('/src/lib/workflows/node-registry.js');
            const nodeTypes = await import('/src/components/create/nodes/index.js');
            
            // Get the ReactFlow instance
            const flowWrapper = document.querySelector('.react-flow');
            const flowInstance = flowWrapper?.__reactFlowInstance;
            
            return {
                registryKeys: Object.keys(registry.NODE_REGISTRY).slice(0, 5),
                nodeTypesKeys: Object.keys(nodeTypes.nodeTypes).slice(0, 10),
                hasFlowInstance: !!flowInstance,
                flowWrapper: !!flowWrapper
            };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Manual node add result: {json.dumps(result, indent=2)}")
    
    # Try using ReactFlow's addNodes method
    add_result = page.evaluate("""async () => {
        try {
            const { addNodes } = await import('/node_modules/.vite/deps/@xyflow_react.js');
            // This won't work directly, but let's check if we can access the flow
            return { addNodes: typeof addNodes };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Add nodes result: {json.dumps(add_result, indent=2)}")
    
    browser.close()
