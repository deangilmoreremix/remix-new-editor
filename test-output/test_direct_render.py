from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try to render a node component directly
    result = page.evaluate("""async () => {
        try {
            const React = await import('/node_modules/.vite/deps/react.js');
            const { createRoot } = await import('/node_modules/.vite/deps/react-dom_client.js');
            const { BaseNode } = await import('/src/components/create/nodes/base-node.jsx');
            
            // Create a container
            const container = document.createElement('div');
            container.style.width = '200px';
            container.style.height = '100px';
            document.body.appendChild(container);
            
            // Render the node
            const root = createRoot(container);
            root.render(React.createElement(BaseNode, {
                data: { label: 'Test', type: 'prompt' },
                selected: false
            }));
            
            return {
                success: true,
                html: container.innerHTML.substring(0, 200)
            };
        } catch (err) {
            return { error: err.message, stack: err.stack };
        }
    }""")
    
    print(f"Direct node render: {json.dumps(result, indent=2)}")
    
    time.sleep(1)
    page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/direct_node_render.png', full_page=True)
    
    browser.close()
