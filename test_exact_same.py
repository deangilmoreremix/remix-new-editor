from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    # Set API key before navigation (EXACT same as working test)
    page.goto('http://localhost:3100')
    key = '355176f9f6a8c7cf0fb643203529c6ecd9b263c7f65cfd53457ed79743c6adb4'
    salt = 'muapi_2024_'
    obfuscated = __import__('base64').b64encode((salt + key).encode()).decode()
    page.evaluate(f"""k => {{
        localStorage.setItem('muapi_key', k);
        localStorage.setItem('muapi_key_hash', 'sandbox');
    }}""", obfuscated)
    
    # Test VideoStudio - EXACT same as working test
    page.goto('http://localhost:3100/?dev#/video')
    page.wait_for_timeout(4000)
    
    # Check for AI Pick button - EXACT same as working test
    ai_pick_text = page.locator('text=AI Pick').count()
    ai_pick_aria = page.locator('button[aria-label="Open model picker"]').count()
    
    print(f"VideoStudio AI Pick by text: {ai_pick_text}")
    print(f"VideoStudio AI Pick by aria-label: {ai_pick_aria}")
    
    # Check current page
    current_page = page.evaluate("window.__debugGetCurrentPage?.()")
    print(f"Current page: {current_page}")
    
    # Get page title
    print(f"Page title: {page.title()}")
    
    # Get all button texts
    all_buttons = page.locator('button').all()
    print(f"Total buttons: {len(all_buttons)}")
    for btn in all_buttons[:20]:
        text = btn.inner_text()
        if text.strip():
            print(f"  Button: {text.strip()[:50]}")
    
    browser.close()
