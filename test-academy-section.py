from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    
    # Navigate to landing page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle', timeout=30000)
    time.sleep(3)
    
    # Scroll to the academy video showcase section
    academy_heading = page.locator('text=Academy Video').first
    if academy_heading.count() > 0:
        academy_heading.scroll_into_view_if_needed()
        time.sleep(1)
        page.screenshot(path='/tmp/academy-showcase.png', full_page=False)
        print("Found and screenshot AcademyVideoShowcase section")
    else:
        page.evaluate('window.scrollTo(0, 6000)')
        time.sleep(2)
        page.screenshot(path='/tmp/landing-scrolled-6000.png', full_page=False)
        print("Scrolled to 6000px and took screenshot")
        
        page.evaluate('window.scrollTo(0, 9000)')
        time.sleep(2)
        page.screenshot(path='/tmp/landing-scrolled-9000.png', full_page=False)
        print("Scrolled to 9000px and took screenshot")
    
    page.evaluate('window.scrollTo(0, 0)')
    time.sleep(1)
    page.screenshot(path='/tmp/landing-complete-full.png', full_page=True)
    print("Full page screenshot taken")
    
    print(f"Page title: {page.title()}")
    print(f"Page URL: {page.url}")
    
    academy_section = page.locator('[data-testid="academy-video-showcase"], #academy-video-showcase, .academy-video-showcase')
    print(f"Academy showcase elements: {academy_section.count()}")
    
    videos = page.locator('video').all()
    print(f"Video elements found: {len(videos)}")
    
    gifs = page.locator('img[src*=".gif"], img[src*="gif"]').all()
    print(f"GIF images found: {len(gifs)}")
    
    browser.close()
