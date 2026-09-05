from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to access workspace context and dispatch
    result = page.evaluate("""async () => {
        try {
            // Import the workspace context module
            const workspaceMod = await import('/src/lib/workspace/workspace-context.jsx');
            const nodeRegistry = await import('/src/lib/workflows/node-registry.js');
            
            // The workspace context is a React context, so we can't easily access it from outside
            // But we can check if the module loads correctly
            return {
                workspaceLoaded: true,
                hasGenerateId: typeof workspaceMod.generateId === 'function',
                hasWorkspaceShell: typeof workspaceMod.WorkspaceShell === 'function',
                registryLoaded: true,
                nodeTypes: Object.keys(nodeRegistry.NODE_REGISTRY).slice(0, 5)
            };
        } catch (err) {
            return { error: err.message };
        }
    }""")
    
    print(f"Workspace check: {json.dumps(result, indent=2)}")
    
    # Try to use the palette to add a node and check the result
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    if len(palette_items) > 0:
        # Click first item
        palette_items[0].click(force=True)
        time.sleep(2)
        
        # Check if any nodes appeared
        nodes = page.locator('.react-flow__node').all()
        print(f"Nodes after palette click: {len(nodes)}")
        
        # Check the palette to see if it's still open
        palette = page.locator('.np')
        print(f"Palette still open: {palette.count() > 0}")
    
    browser.close()
