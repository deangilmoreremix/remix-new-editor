from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to manually dispatch a node addition
    result = page.evaluate("""async () => {
        try {
            // Import workspace context to get dispatch
            const workspaceMod = await import('/src/lib/workspace/workspace-context.jsx');
            const nodeRegistry = await import('/src/lib/workflows/node-registry.js');
            
            // Get the workspace context
            // We need to find a React component that uses the context
            // Let's try to access it through the React tree
            
            return {
                workspaceKeys: Object.keys(workspaceMod),
                hasGenerateId: typeof workspaceMod.generateId === 'function',
                registryKeys: Object.keys(nodeRegistry.NODE_REGISTRY).slice(0, 5)
            };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Manual dispatch result: {json.dumps(result, indent=2)}")
    
    # Try adding a node by simulating the palette selection
    add_result = page.evaluate("""async () => {
        try {
            const { NODE_REGISTRY, CATEGORY_COLORS } = await import('/src/lib/workflows/node-registry.js');
            const { generateId } = await import('/src/lib/workspace/workspace-context.jsx');
            
            // Create a simple node
            const nodeType = 'prompt';
            const definition = NODE_REGISTRY[nodeType];
            if (!definition) return { error: 'Node type not found' };
            
            const newNode = {
                id: generateId(),
                type: nodeType,
                position: { x: 100, y: 100 },
                data: {
                    type: nodeType,
                    label: definition.label,
                    config: { ...definition.defaultData }
                }
            };
            
            return { newNode, nodeType: definition.label };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Add node result: {json.dumps(add_result, indent=2)}")
    
    browser.close()
