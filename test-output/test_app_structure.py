from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Check #app children
    result = page.evaluate("""async () => {
        const app = document.querySelector('#app');
        if (!app) return { error: 'no app' };
        
        const children = Array.from(app.children).map(child => ({
            tag: child.tagName,
            id: child.id,
            classes: child.className,
            hasFiber: Object.keys(child).some(k => k.includes('reactFiber')),
            fiberKey: Object.keys(child).find(k => k.includes('reactFiber'))
        }));
        
        return { children, childCount: children.length };
    }""")
    
    print(f"App children: {json.dumps(result, indent=2)}")
    
    # Also check the container inside #app
    container_info = page.evaluate("""async () => {
        const app = document.querySelector('#app');
        const containers = app.querySelectorAll('div');
        
        // Find the one with react-flow
        for (const div of containers) {
            if (div.classList.contains('react-flow')) {
                const fiberKey = Object.keys(div).find(k => k.includes('reactFiber'));
                return {
                    found: true,
                    fiberKey,
                    hasFiber: !!fiberKey,
                    classes: div.className
                };
            }
        }
        return { found: false };
    }""")
    
    print(f"React flow container: {json.dumps(container_info, indent=2)}")
    
    browser.close()
