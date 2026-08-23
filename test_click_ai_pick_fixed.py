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
    
    # Check for AI Pick button
    ai_pick_count = page.locator('text=AI Pick').count()
    print(f"AI Pick buttons found: {ai_pick_count}")
    
    if ai_pick_count > 0:
        # Click the button - use .first as property, not method
        page.locator('text=AI Pick').first.click()
        page.wait_for_timeout(3000)
        
        # Check for any errors or new content
        body_text = page.evaluate("() => document.body.innerText")
        
        # Look for model names or picker-related content
        model_names = ['Flux', 'Ideogram', 'SDXL', 'MiniMax', 'Hunyuan', 'Runway', 'Pika', 'Luma', 'Kling']
        found_models = [m for m in model_names if m.lower() in body_text.lower()]
        print(f"Model names found after click: {found_models}")
        
        # Check for dropdown/modal text
        picker_texts = ['select model', 'choose model', 'model picker', 'text-to-video', 'image-to-video']
        found_picker = [t for t in picker_texts if t.lower() in body_text.lower()]
        print(f"Picker-related text found: {found_picker}")
        
        # Take screenshot
        page.screenshot(path='/tmp/video_after_ai_pick.png', full_page=True)
        print("Screenshot saved to /tmp/video_after_ai_pick.png")
        
    else:
        print("AI Pick button not found!")
    
    browser.close()
