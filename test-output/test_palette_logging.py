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
    
    # Open palette
    page.keyboard.press('Space')
    time.sleep(0.5)
    
    # Focus first item and press Enter
    palette_items = page.locator('.np__item').all()
    if len(palette_items) > 0:
        palette_items[0].focus()
        time.sleep(0.2)
        page.keyboard.press('Enter')
        time.sleep(2)
    
    # Check for our log messages
    palette_logs = [log for log in console_logs if 'NodePalette' in log['text'] or 'handlePaletteSelect' in log['text']]
    print(f"Palette logs: {len(palette_logs)}")
    for log in palette_logs:
        print(f"  {log['text']}")
    
    # Check nodes
    node_count = page.locator('.react-flow__node').count()
    print(f"Nodes after Enter: {node_count}")
    
    browser.close()
