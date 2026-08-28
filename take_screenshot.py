from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:5173/leadfinder', wait_until='networkidle', timeout=60000)
    page.wait_for_timeout(3000)
    page.screenshot(path='/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/alive-barn/leadfinder-redesign.png', full_page=False)
    print("Screenshot saved")
    browser.close()
