from playwright.sync_api import sync_playwright
import json
import time

console_logs = []

def handle_console_message(msg):
    console_logs.append({'type': msg.type, 'text': msg.text})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on("console", handle_console_message)
    
    page.goto('http://localhost:3000/#/spaces')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Clear logs
    console_logs.clear()
    
    # Open palette and select with Enter
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    palette_items = page.locator('.np__item').all()
    if len(palette_items) > 0:
        palette_items[0].focus()
        time.sleep(0.2)
        page.keyboard.press('Enter')
        time.sleep(2)
    
    # Check for any new console logs
    print(f"Console logs after add: {len(console_logs)}")
    for log in console_logs:
        if 'handlePaletteSelect' in log['text'] or 'NodePalette' in log['text'] or 'error' in log['type'].lower():
            print(f"  [{log['type']}] {log['text'][:200]}")
    
    # Check ReactFlow nodes prop
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
                return {
                    found: true,
                    nodeCount: nodes.length,
                    firstNode: nodes.length > 0 ? {
                        id: nodes[0].id,
                        type: nodes[0].type,
                        position: nodes[0].position,
                        data: nodes[0].data
                    } : null
                };
            }
            
            if (current.child) queue.push(current.child);
            if (current.sibling) queue.push(current.sibling);
        }
        
        return { error: 'ReactFlow not found' };
    }""")
    
    print(f"\nReactFlow state: {json.dumps(flow_state, indent=2)}")
    
    browser.close()
