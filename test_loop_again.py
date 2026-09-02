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
    
    # Test studios with exact same loop as working test
    studios = [
        ('ImageStudio', '#/image'),
        ('VideoStudio', '#/video'),
        ('CinemaStudio', '#/cinema'),
        ('CharacterStudio', '#/character'),
        ('AvatarStudio', '#/avatar'),
        ('EffectsStudio', '#/effects'),
        ('CommercialStudio', '#/commercial'),
        ('InfluencerStudio', '#/influencer'),
    ]
    
    for name, route in studios:
        page.goto(f'http://localhost:3100/?dev{route}')
        page.wait_for_timeout(4000)
        
        ai_pick_text = page.locator('text=AI Pick').count()
        ai_pick_aria = page.locator('button[aria-label="Open model picker"]').count()
        current_page = page.evaluate("window.__debugGetCurrentPage?.()")
        
        status = 'PASS' if ai_pick_text > 0 else 'FAIL'
        print(f"{name}: {status} (text={ai_pick_text}, aria={ai_pick_aria}, page={current_page})")
    
    browser.close()
