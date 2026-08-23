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
    page.wait_for_timeout(5000)
    
    # Use JavaScript to find the button directly
    button_info = page.evaluate("""() => {
        // Search for any element containing 'AI Pick' text
        const allElements = Array.from(document.querySelectorAll('*'));
        const matches = allElements.filter(el => {
            const text = el.textContent || '';
            return text.includes('AI Pick');
        });
        
        return matches.map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 100),
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className,
            visible: el.offsetParent !== null
        }));
    }""")
    
    print(f"Elements containing 'AI Pick': {len(button_info)}")
    for info in button_info[:5]:
        print(f"  {info}")
    
    # Also check for model picker related elements
    model_picker_info = page.evaluate("""() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        return allElements.filter(el => {
            const text = (el.textContent || '').toLowerCase();
            return text.includes('model picker') || text.includes('open model picker');
        }).length;
    }""")
    print(f"Elements with 'model picker' text: {model_picker_info}")
    
    browser.close()
