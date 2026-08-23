from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    # Set API key before navigation
    page.goto('http://localhost:3100/?dev')
    key = '355176f9f6a8c7cf0fb643203529c6ecd9b263c7f65cfd53457ed79743c6adb4'
    salt = 'muapi_2024_'
    obfuscated = __import__('base64').b64encode((salt + key).encode()).decode()
    page.evaluate(f"""k => {{
        localStorage.setItem('muapi_key', k);
        localStorage.setItem('muapi_key_hash', 'sandbox');
    }}""", obfuscated)
    
    # Test studios
    studios = [
        ('VideoStudio', '#/video'),
        ('ImageStudio', '#/image'),
        ('CinemaStudio', '#/cinema'),
        ('CharacterStudio', '#/character'),
        ('AvatarStudio', '#/avatar'),
        ('EffectsStudio', '#/effects'),
        ('CommercialStudio', '#/commercial'),
        ('InfluencerStudio', '#/influencer'),
    ]
    
    results = {}
    for name, route in studios:
        page.goto(f'http://localhost:3100/?dev{route}')
        page.wait_for_timeout(3000)
        has_ai_pick = page.locator('button:has-text("AI Pick")').count() > 0
        results[name] = has_ai_pick
        print(f"{name}: {'FOUND' if has_ai_pick else 'MISSING'}")
        
        # Get page content length to verify studio loaded
        content = page.content()
        print(f"  Page HTML length: {len(content)}")
    
    browser.close()
