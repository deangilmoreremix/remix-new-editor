from playwright.sync_api import sync_playwright

URL = "http://localhost:3100/#/image"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1200})
        page = context.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(msg) if msg.type == "error" else None)

        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Open the model dropdown by clicking the model button
        page.evaluate("""() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const match = btns.find(b => b.textContent.includes('Nano Banana'));
          if (match) match.click();
        }""")
        page.wait_for_timeout(700)

        # Pick a model via JS click to bypass viewport/header interception
        chosen = page.evaluate("""() => {
          const items = Array.from(document.querySelectorAll('[data-model-id]'));
          const target = items.find(el => el.innerText.includes('Flux')) || items[1];
          if (!target) return null;
          target.scrollIntoView({block: 'center'});
          target.click();
          return target.getAttribute('data-model-id') + ' | ' + target.innerText.trim().slice(0, 80);
        }""")

        page.wait_for_timeout(700)

        # Read the selected model from the dropdown after selection
        after = page.evaluate("""() => {
          const items = Array.from(document.querySelectorAll('[data-model-id]'));
          const selected = items.find(el => el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-white/5'));
          if (selected) return selected.getAttribute('data-model-id') + ' | ' + selected.innerText.trim().slice(0, 80);
          const allLabels = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 60);
          return allLabels.slice(0,5).join(' || ');
        }""")

        # Only flag model-selection-specific errors (ignore pre-existing popcorn/CSP noise)
        model_errors = [e.text for e in errors if 'inputs' in e.text or 'Cannot read' in e.text]
        console_errors = [e.text for e in errors]

        print("CHOSEN_MODEL:", chosen)
        print("AFTER_STATE:", after)
        print("MODEL_ERRORS:")
        for e in model_errors:
            print(" -", e)
        print("TOTAL_CONSOLE_ERRORS:", len(console_errors))

        # Pass criteria: no model-selection TypeError, and a model was chosen
        passed = len(model_errors) == 0 and chosen is not None
        print("RESULT:", "PASS" if passed else "FAIL")
        browser.close()

if __name__ == "__main__":
    run()
