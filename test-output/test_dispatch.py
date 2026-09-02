from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to dispatch node addition through workspace context
    result = page.evaluate("""async () => {
        try {
            // Import the workspace module to get generateId
            const workspaceMod = await import('/src/lib/workspace/workspace-context.jsx');
            const nodeRegistry = await import('/src/lib/workflows/node-registry.js');
            
            // Create a node manually
            const nodeType = 'prompt';
            const definition = nodeRegistry.NODE_REGISTRY[nodeType];
            if (!definition) return { error: 'Node type not found' };
            
            const newNode = {
                id: workspaceMod.generateId(),
                type: nodeType,
                position: { x: 300, y: 300 },
                data: {
                    type: nodeType,
                    label: definition.label,
                    config: { ...definition.defaultData }
                }
            };
            
            // Try to find and call the workspace dispatch
            // The workspace context is provided by WorkspaceShell
            // Let's try to find it in the React tree
            
            const flowWrapper = document.querySelector('.react-flow');
            if (!flowWrapper) return { error: 'no flow' };
            
            const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
            const fiber = flowWrapper[fiberKey];
            
            // Traverse up to find WorkspaceShell
            let current = fiber;
            while (current && current.return) {
                current = current.return;
                if (current.memoizedProps && current.memoizedProps.children) {
                    // Check if this is WorkspaceShell
                    const stateNode = current.stateNode;
                    if (stateNode) {
                        // Try to access context
                        try {
                            // Access React context through fiber
                            const contextKey = Object.keys(current).find(k => k.includes('context'));
                            if (contextKey) {
                                const context = current[contextKey];
                                return {
                                    found: true,
                                    contextKeys: context ? Object.keys(context) : null
                                };
                            }
                        } catch (e) {}
                    }
                }
            }
            
            return { 
                newNode,
                error: 'Could not access workspace context'
            };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Dispatch result: {json.dumps(result, indent=2)}")
    
    browser.close()
