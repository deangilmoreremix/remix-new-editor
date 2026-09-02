from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Open palette
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    # Try to directly access palette and call onSelect
    result = page.evaluate("""async () => {
        // Find the palette component
        const palette = document.querySelector('.np');
        if (!palette) return { error: 'no palette' };
        
        // Get the palette's React fiber
        const fiberKey = Object.keys(palette).find(k => k.includes('reactFiber'));
        const fiber = palette[fiberKey];
        
        // Find the onSelect prop
        let current = fiber;
        while (current) {
            if (current.memoizedProps && typeof current.memoizedProps.onSelect === 'function') {
                // Found the palette - call onSelect with a test node type
                try {
                    current.memoizedProps.onSelect('prompt');
                    return { success: true, called: true };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
            if (current.return) current = current.return;
            else break;
        }
        
        return { error: 'onSelect not found', fiberKeys: Object.keys(fiber.memoizedProps || {}) };
    }""")
    
    print(f"Direct palette call: {json.dumps(result, indent=2)}")
    
    time.sleep(2)
    
    # Check nodes
    node_count = page.locator('.react-flow__node').count()
    print(f"Nodes after direct call: {node_count}")
    
    if node_count > 0:
        page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/test-output/direct_palette_call.png', full_page=True)
    
    browser.close()
