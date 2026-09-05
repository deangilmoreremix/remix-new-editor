from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Find the React root inside #app
    result = page.evaluate("""async () => {
        const app = document.querySelector('#app');
        if (!app) return { error: 'no app' };
        
        // Look for React fiber in children
        const children = app.children;
        for (const child of children) {
            const fiberKey = Object.keys(child).find(k => k.includes('reactFiber'));
            if (fiberKey) {
                const fiber = child[fiberKey];
                return {
                    found: true,
                    elementTag: child.tagName,
                    elementClasses: child.className,
                    fiberType: fiber.type ? (typeof fiber.type === 'string' ? fiber.type : fiber.type?.name || fiber.type?.displayName) : null
                };
            }
        }
        
        return { error: 'no fiber found', childCount: children.length };
    }""")
    
    print(f"React root: {json.dumps(result, indent=2)}")
    
    browser.close()
