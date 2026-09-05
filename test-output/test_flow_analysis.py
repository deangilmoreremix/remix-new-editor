from playwright.sync_api import sync_playwright
import json
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Try multiple ways to access ReactFlow state
    result = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        // Try to find ReactFlow instance
        const candidates = [];
        
        // Method 1: Check __reactFlowInstance
        if (flowWrapper.__reactFlowInstance) {
            candidates.push({ method: '__reactFlowInstance', found: true });
        }
        
        // Method 2: Check React fiber
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber') || k.includes('reactInternal'));
        if (fiberKey) {
            const fiber = flowWrapper[fiberKey];
            candidates.push({ method: 'fiber', fiberKey, stateNode: fiber.stateNode ? Object.keys(fiber.stateNode) : null });
        }
        
        // Method 3: Check data attributes
        const dataAttrs = {};
        for (const attr of flowWrapper.attributes) {
            if (attr.name.startsWith('data-')) {
                dataAttrs[attr.name] = attr.value;
            }
        }
        
        // Method 4: Get all child elements
        const children = flowWrapper.querySelectorAll('*');
        const childClasses = Array.from(children).map(c => c.className).filter(Boolean);
        
        return {
            flowWrapperId: flowWrapper.id,
            flowWrapperClasses: flowWrapper.className,
            dataAttrs,
            candidates,
            childCount: children.length,
            sampleChildren: childClasses.slice(0, 20)
        };
    }""")
    
    print(f"Flow analysis: {json.dumps(result, indent=2)}")
    
    browser.close()
