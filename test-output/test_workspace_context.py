from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to access workspace context and dispatch directly
    result = page.evaluate("""async () => {
        // Find WorkspaceShell component
        const app = document.querySelector('#app');
        if (!app) return { error: 'no app' };
        
        const fiberKey = Object.keys(app).find(k => k.includes('reactFiber'));
        const rootFiber = app[fiberKey];
        
        // BFS to find WorkspaceShell
        const queue = [rootFiber];
        const visited = new Set();
        
        while (queue.length > 0) {
            const fiber = queue.shift();
            if (!fiber || visited.has(fiber)) continue;
            visited.add(fiber);
            
            // Check if this is WorkspaceShell
            if (fiber.memoizedProps && typeof fiber.memoizedProps.children === 'object') {
                // Found WorkspaceShell - get its context
                const stateNode = fiber.stateNode;
                if (stateNode && stateNode._context) {
                    return {
                        found: true,
                        contextKeys: Object.keys(stateNode._context),
                        stateKeys: stateNode._context._currentValue ? Object.keys(stateNode._context._currentValue.state || {}) : null
                    };
                }
            }
            
            if (fiber.child) queue.push(fiber.child);
            if (fiber.sibling) queue.push(fiber.sibling);
        }
        
        return { error: 'WorkspaceShell not found', visited: visited.size };
    }""")
    
    print(f"Workspace context: {json.dumps(result, indent=2)}")
    
    browser.close()
