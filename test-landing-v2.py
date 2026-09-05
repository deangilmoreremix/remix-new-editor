from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    
    # Navigate to landing page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(2)
    
    # Find the apps grid section by looking for the heading text
    # The heading contains "33 AI Creative Apps"
    apps_heading = page.locator('text=33 AI Creative Apps').first
    if apps_heading.count() > 0:
        # Scroll to the heading
        apps_heading.scroll_into_view_if_needed()
        time.sleep(1)
        
        # Take screenshot of the apps section (from heading to below the grid)
        page.screenshot(path='/tmp/apps-section-with-heading.png', full_page=False)
        print("Screenshot 1: Apps section with heading")
        
        # Now scroll down a bit more to see the category tabs and grid
        page.evaluate('window.scrollBy(0, 200)')
        time.sleep(1)
        page.screenshot(path='/tmp/apps-category-tabs.png', full_page=False)
        print("Screenshot 2: Category tabs")
        
        # Scroll down more to see the actual app cards
        page.evaluate('window.scrollBy(0, 300)')
        time.sleep(1)
        page.screenshot(path='/tmp/apps-grid-cards.png', full_page=False)
        print("Screenshot 3: App cards grid")
        
        # Try to get a wider view of multiple cards
        page.set_viewport_size({'width': 1600, 'height': 900})
        page.evaluate('window.scrollBy(0, -100)')
        time.sleep(1)
        page.screenshot(path='/tmp/apps-grid-wide.png', full_page=False)
        print("Screenshot 4: Wider view of apps grid")
    else:
        print("Could not find apps heading")
        # Fallback: just scroll and take multiple screenshots
        for i, scroll_pos in enumerate([1000, 2000, 3000, 4000]):
            page.evaluate(f'window.scrollTo(0, {scroll_pos})')
            time.sleep(1)
            page.screenshot(path=f'/tmp/landing-scroll-{scroll_pos}.png', full_page=False)
            print(f"Screenshot {i+5}: Scrolled to {scroll_pos}px")
    
    # Take a final full page screenshot for reference
    page.set_viewport_size({'width': 1400, 'height': 900})
    page.evaluate('window.scrollTo(0, 0)')
    time.sleep(1)
    page.screenshot(path='/tmp/landing-final-full.png', full_page=True)
    print("Screenshot final: Full page")
    
    # Print some debug info
    print("\n=== Debug Info ===")
    print(f"Page title: {page.title()}")
    print(f"Page URL: {page.url}")
    
    # Count sections and cards
    sections = page.locator('section').all()
    print(f"Total sections found: {len(sections)}")
    
    # Try to find the apps grid container
    apps_grid = page.locator('[id*="apps"], [class*="apps"], [data-testid*="apps"]')
    print(f"Apps grid elements found: {apps_grid.count()}")
    
    # Look for category tabs
    category_texts = ['All', 'Create', 'Enhance', 'Produce', 'Localize', 'Automate', 'Scale']
    for cat in category_texts:
        if page.locator(f'text={cat}').count() > 0:
            print(f"✓ Found category tab: {cat}")
    
    browser.close()
