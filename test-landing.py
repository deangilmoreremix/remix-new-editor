from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    
    # Navigate to landing page
    page.goto('http://localhost:3000')
    
    # Wait for page to load completely
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(2)
    
    # Take screenshot of top section
    page.screenshot(path='/tmp/landing-top.png', full_page=False)
    
    # Try to find and scroll to apps grid section
    # First, let's see what sections exist
    sections = page.locator('section').all()
    print(f"Found {len(sections)} sections")
    
    # Try to find apps grid by common selectors
    apps_grid = page.locator('[data-testid="apps-grid-section"], #apps-grid, .apps-grid, [id*="apps"]').first
    if apps_grid.count() > 0:
        apps_grid.scroll_into_view_if_needed()
        time.sleep(1)
        page.screenshot(path='/tmp/apps-grid-section.png', full_page=False)
        print("Found and screenshot apps grid")
    else:
        # Try scrolling down to find it
        page.evaluate('window.scrollTo(0, 2000)')
        time.sleep(2)
        page.screenshot(path='/tmp/landing-scrolled-2000.png', full_page=False)
        print("Scrolled to 2000px and took screenshot")
    
    # Try to find all app cards
    app_cards = page.locator('[data-testid="app-card"], .app-card, [class*="app-card"]').all()
    print(f"Found {len(app_cards)} app cards")
    
    # Take full page screenshot
    page.screenshot(path='/tmp/landing-full.png', full_page=True)
    
    # Get page content for debugging
    content = page.content()
    with open('/tmp/landing-content.html', 'w') as f:
        f.write(content)
    
    print("Screenshots saved to /tmp/")
    browser.close()
