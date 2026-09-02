from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    # Set API key before navigation
    page.goto('http://localhost:3100')
    key = '355176f9f6a8c7cf0fb643203529c6ecd9b263c7f65cfd53457ed79743c6adb4'
    salt = 'muapi_2024_'
    obfuscated = __import__('base64').b64encode((salt + key).encode()).decode()
    page.evaluate(f"""k => {{
        localStorage.setItem('muapi_key', k);
        localStorage.setItem('muapi_key_hash', 'sandbox');
    }}""", obfuscated)
    
    # Test VideoStudio
    page.goto('http://localhost:3100/?dev#/video')
    page.wait_for_timeout(4000)
    
    # Use the exact same locator that worked before
    ai_pick_text = page.locator('text=AI Pick').count()
    ai_pick_aria = page.locator('button[aria-label="Open model picker"]').count()
    
    print(f"VideoStudio AI Pick by text: {ai_pick_text}")
    print(f"VideoStudio AI Pick by aria-label: {ai_pick_aria}")
    
    if ai_pick_text > 0:
        # Click using the text locator
        page.locator('text=AI Pick').first().click()
        page.wait_for_timeout(2000)
        
        # Check what appeared after clicking
        body_content = page.content()
        
        # Check for common modal/dropdown indicators
        has_dropdown = 'dropdown' in body_content.lower() or 'model-picker' in body_content.lower()
        has_modal = 'modal' in body_content.lower() or 'dialog' in body_content.lower()
        
        print(f"After click - dropdown/modal indicators: dropdown={has_dropdown}, modal={has_modal}")
        
        # Check for any new elements that appeared
        all_divs = page.locator('div').count()
        print(f"Total divs on page: {all_divs}")
        
        # Try to find any popup/modal that might have opened
        fixed_elements = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('div')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.position === 'fixed' || style.zIndex > 100;
            }).length;
        }""")
        print(f"Fixed/high-z-index elements: {fixed_elements}")
        
        # Check for any new text content that might indicate model picker opened
        page_text = page.evaluate("() => document.body.innerText")
        model_picker_text = ['model', 'picker', 'select', 'choose', 'flux', 'ideogram', 'sdxl', 'minimax']
        found_texts = [t for t in model_picker_text if t.lower() in page_text.lower()]
        print(f"Model picker related text found: {found_texts[:10]}")
        
        # Take screenshot after click
        page.screenshot(path='/tmp/after_ai_pick_click.png', full_page=True)
        print("Screenshot saved to /tmp/after_ai_pick_click.png")
        
    else:
        print("AI Pick button not found!")
    
    browser.close()
