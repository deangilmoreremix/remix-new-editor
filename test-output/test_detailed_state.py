from playwright.sync_api import sync_playwright
import json
import time

console_logs = []
page_errors = []

def handle_console_message(msg):
    entry = {'type': msg.type, 'text': msg.text}
    console_logs.append(entry)
    if msg.type == 'error':
        page_errors.append(entry)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on("console", handle_console_message)
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Clear initial errors
    page_errors.clear()
    console_logs.clear()
    
    # Open palette and add node via Enter
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    if len(palette_items) > 0:
        palette_items[0].focus()
        time.sleep(0.2)
        page.keyboard.press('Enter')
        time.sleep(2)
    
    print(f"Errors after add: {len(page_errors)}")
    for err in page_errors:
        print(f"  [{err['type']}] {err['text'][:200]}")
    
    # Check ReactFlow state
    flow_state = page.evaluate("""async () => {
        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) return { error: 'no flow' };
        
        const fiberKey = Object.keys(flowWrapper).find(k => k.includes('reactFiber'));
        const fiber = flowWrapper[fiberKey];
        
        const queue = [fiber];
        const visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            visited.add(current);
            
            if (current.memoizedProps && 'nodes' in current.memoizedProps && 'edges' in current.memoizedProps) {
                const nodes = current.memoizedProps.nodes || [];
                const edges = current.memoizedProps.edges || [];
                return {
                    found: true,
                    nodeCount: nodes.length,
                    edgeCount: edges.length,
                    firstNode: nodes.length > 0 ? { id: nodes[0].id, type: nodes[0].type, position: nodes[0].position } : null
                };
            }
            
            if (current.child) queue.push(current.child);
            if (current.sibling) queue.push(current.sibling);
        }
        
        return { error: 'ReactFlow not found' };
    }""")
    
    print(f"\nReactFlow state: {json.dumps(flow_state, indent=2)}")
    
    # Check DOM nodes
    dom_nodes = page.locator('.react-flow__node').all()
    print(f"DOM nodes: {len(dom_nodes)}")
    
    browser.close()
