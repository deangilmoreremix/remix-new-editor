// CheckoutCTA — contextual video-section checkout button.
//
// Redesigned to match the exit-intent modal's aesthetic:
//   - Solid cyan-400 background (no gradient)
//   - 12px border radius
//   - Inter font (loaded in index.html)
//   - Modal-style shadows and hover transform (translateY)
//   - Provider icons in a separate card below the button
//   - Subtext below the button
//
// Usage:
//   const el = CheckoutCTA({
//     variant: 'primary',   // or 'inline'
//     offer: {
//       id: 'cinematic-trailers',
//       cta: 'Get AI Cinematic Story Study',
//       headline: 'AI Cinematic Story Study',
//       description: 'Create movie-quality trailers with AI.',
//       price: '$199',
//     },
//     providers: ['visa','mastercard','amex','discover','jcb','affirm','klarna','afterpay'],
//     subtext: 'Secure checkout • 30-day money-back guarantee',
//     onCheckout: () => { /* redirect to Stripe */ },
//   });

const PROVIDER_SYMBOLS = {
  visa: `<path d="M4 9.5h6.5c2 0 3.2 1 3.2 2.5S12.5 14 10.5 14H4V9.5zM5 10.5v2h4.5c.8 0 1.5-.4 1.5-1s-.7-1-1.5-1H5v2zm0 3.5v2.5h6c1.5 0 2.5-.8 2.5-2s-1-2-2.5-2H5v1.5h4.5c.5 0 1 .3 1 .8 0 .5-.5.7-1 .7H5v1.5zM16 9.5h2.5l1.5 3.5h.1L21.5 9.5H24l-2.5 5.5h-2L16 9.5zM11 9.5h2.5v5.5h-2.5V9.5z"/>`,
  mastercard: `<circle cx="10" cy="12" r="6" fill="currentColor" opacity="0.9"/><circle cx="18" cy="12" r="6" fill="currentColor" opacity="0.6"/>`,
  amex: `<path d="M12 4.5l-5 9h2l.5-1h3l.5 1h2L12 4.5zm-1.5 5.5l1-2h1.5l1 2h-3.5zM19 13h-2.5l-.5-1h-2l-.5 1H11.5l2.5-5.5H17L19 13zm-2-2.5h-1l-.3-.5-.2.5h-.5L15 7.5h1.5l.5 1 .2-.5h.3l.2.5.5-1H17z"/>`,
  discover: `<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16.5c-4.14 0-7.5-3.36-7.5-7.5S7.86 4.5 12 4.5s7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zM14 8.5v3h2.5v1H14v3h3v1h-4.5V8.5H14z"/>`,
  jcb: `<rect x="2" y="4" width="20" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="6" y="7" width="5" height="7" rx="1" fill="currentColor" opacity="0.9"/><rect x="13" y="7" width="5" height="7" rx="1" fill="currentColor" opacity="0.6"/>`,
  affirm: `<path d="M10.5 6.5c-2 0-3.5 1.5-3.5 3.5s1.5 3.5 3.5 3.5c1 0 2-.4 2.5-1l.5.7h1.8V6.5H14l.5.7c-.5.6-1.5 1-2.5 1-1.7 0-3-1.3-3-3s1.3-3 3-3c1 0 1.8.4 2.5 1 .3.3.5.7.5 1.2v.6h-1.8v-.6c0-.3-.2-.7-.5-1-.3-.3-.7-.4-1.2-.4zM18 6.5h1.8v5.8l2 2.2H22l-2.2-2.5L22 9h-1.8l-1.2 1.5L18 9h-1.5v3h1.5V6.5H18z"/>`,
  klarna: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9.5c0-1.7 1.3-3 3-3 .8 0 1.5.3 2 .7.2.2.4.4.6.7.2.3.3.5.3.8h-2c0-.2-.2-.5-.5-.5-.3 0-.5.2-.5.5 0 .2 0 .3.2.5l.2.3c.5.5.7 1 .7 1.5 0 1-.8 1.8-1.8 1.8h-2.5v-5.8z" fill="currentColor"/>`,
  afterpay: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 10.5v3h3.5v1.5H9V19h4.5v-1.5H10V16h3v-1.5H10V10.5H9z" fill="currentColor"/>`,
};

let symbolsInjected = false;
let stylesInjected = false;

const MODAL_DESIGN_TOKENS = {
  bgDeep: '#020205',
  bgSurface: '#05070b',
  bgCard: 'rgba(255, 255, 255, 0.025)',
  borderCard: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  primary: '#22d3ee',
  primaryHover: '#34d399',
  primarySoft: 'rgba(34, 211, 238, 0.10)',
  primaryGlow: 'rgba(34, 211, 238, 0.25)',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#52525b',
  radiusLg: '1.5rem',
  radiusXl: '2rem',
};

function injectModalStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes checkout-ripple-anim {
      0% { transform: scale(0); opacity: 0.6; }
      100% { transform: scale(4); opacity: 0; }
    }

    .checkout-cta {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    /* Primary button — matches modal .cta-button */
    .checkout-cta--primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 480px;
      background: ${MODAL_DESIGN_TOKENS.primary};
      color: ${MODAL_DESIGN_TOKENS.bgDeep};
      font-size: 16px;
      font-weight: 800;
      text-align: center;
      padding: 18px 24px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 20px ${MODAL_DESIGN_TOKENS.primaryGlow}, 0 8px 30px rgba(34, 211, 238, 0.2);
      letter-spacing: 0.3px;
    }

    .checkout-cta--primary:hover {
      background: ${MODAL_DESIGN_TOKENS.primaryHover};
      box-shadow: 0 0 30px ${MODAL_DESIGN_TOKENS.primaryGlow}, 0 12px 40px rgba(34, 211, 238, 0.3);
      transform: translateY(-2px);
    }

    .checkout-cta--primary:active {
      transform: translateY(0) scale(0.98);
    }

    .checkout-cta--primary .cta-arrow {
      display: inline-block;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .checkout-cta--primary:hover .cta-arrow {
      transform: translateX(4px);
    }

    /* Inline button — same modal style but compact for pricing cards */
    .checkout-cta--inline {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: ${MODAL_DESIGN_TOKENS.primary};
      color: ${MODAL_DESIGN_TOKENS.bgDeep};
      font-size: 14px;
      font-weight: 800;
      text-align: center;
      padding: 14px 20px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 20px ${MODAL_DESIGN_TOKENS.primaryGlow}, 0 8px 30px rgba(34, 211, 238, 0.2);
      letter-spacing: 0.3px;
    }

    .checkout-cta--inline:hover {
      background: ${MODAL_DESIGN_TOKENS.primaryHover};
      box-shadow: 0 0 30px ${MODAL_DESIGN_TOKENS.primaryGlow}, 0 12px 40px rgba(34, 211, 238, 0.3);
      transform: translateY(-2px);
    }

    .checkout-cta--inline:active {
      transform: translateY(0) scale(0.98);
    }

    .checkout-cta--inline .cta-arrow {
      display: inline-block;
      transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .checkout-cta--inline:hover .cta-arrow {
      transform: translateX(4px);
    }

    /* Focus ring */
    .checkout-cta:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px ${MODAL_DESIGN_TOKENS.bgDeep}, 0 0 0 4px ${MODAL_DESIGN_TOKENS.primary};
    }

    /* Subtext — matches modal .cta-sub */
    .checkout-subtext {
      text-align: center;
      font-size: 12px;
      color: ${MODAL_DESIGN_TOKENS.textMuted};
      margin-top: 12px;
      line-height: 1.5;
    }

    /* Provider card — matches modal .value-column / .bonus-card styling */
    .checkout-providers {
      margin-top: 12px;
      padding: 12px 16px;
      background: ${MODAL_DESIGN_TOKENS.bgCard};
      border: 1px solid ${MODAL_DESIGN_TOKENS.borderCard};
      border-radius: 12px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .checkout-providers .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .checkout-providers-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      justify-content: center;
    }

    .checkout-provider-icon {
      width: 24px;
      height: 24px;
      opacity: 0.75;
      transition: opacity 0.3s ease, transform 0.3s ease;
      flex-shrink: 0;
    }

    .checkout-cta--primary:hover .checkout-provider-icon {
      opacity: 1;
    }

    /* Enter animation — matches modal .animate-in */
    .checkout-cta-enter {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .checkout-cta-enter.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .checkout-cta--primary,
      .checkout-cta--inline {
        transition: none;
        transform: none;
      }
      .checkout-cta-enter {
        opacity: 1;
        transform: none;
      }
      .checkout-cta--primary:hover .cta-arrow,
      .checkout-cta--inline:hover .cta-arrow {
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function injectProviderSymbols() {
  if (symbolsInjected) return;
  symbolsInjected = true;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.overflow = 'hidden';

  for (const [name, path] of Object.entries(PROVIDER_SYMBOLS)) {
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.setAttribute('id', `provider-${name}`);
    symbol.setAttribute('viewBox', '0 0 24 24');
    symbol.innerHTML = path;
    svg.appendChild(symbol);
  }

  document.body.appendChild(svg);
}

function createProviderIcon(name, size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${size}px`);
  svg.setAttribute('height', `${size}px`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('checkout-provider-icon');

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#provider-${name}`);
  svg.appendChild(use);

  return svg;
}

function createRippleEffect(button, event) {
  const ripple = document.createElement('span');
  ripple.classList.add('checkout-ripple');

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    transform: scale(0);
    animation: checkout-ripple-anim 0.6s ease-out forwards;
    pointer-events: none;
    z-index: 10;
  `;

  button.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

/**
 * CheckoutCTA — modal-inspired checkout button.
 *
 * @param {Object} params
 * @param {'primary'|'inline'} params.variant
 * @param {Object} params.offer  - { id, cta, headline, description, price }
 * @param {string[]} params.providers
 * @param {string} params.subtext
 * @param {Function} params.onCheckout
 * @returns {HTMLElement} - button element (primary) or wrapper div (primary with providers)
 */
function CheckoutCTA({ variant = 'primary', offer = {}, providers = [], subtext = '', onCheckout = () => {} }) {
  const isPrimary = variant === 'primary';
  const {
    id = 'checkout',
    cta = 'Get Started',
    headline = '',
    description = '',
    price = '',
  } = offer;

  injectModalStyles();
  injectProviderSymbols();

  // Build the button text (cta is the visible button text)
  const buttonText = price ? cta.replace('{price}', price) : cta;

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-checkout-cta', id);
  button.setAttribute('aria-label', buttonText);
  button.classList.add('checkout-cta', isPrimary ? 'checkout-cta--primary' : 'checkout-cta--inline');

  // Button text + arrow
  const textSpan = document.createElement('span');
  textSpan.textContent = buttonText;
  button.appendChild(textSpan);

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.classList.add('cta-arrow');
  arrow.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>`;
  button.appendChild(arrow);

  // Click handler
  button.addEventListener('click', (event) => {
    createRippleEffect(button, event);
    setTimeout(() => onCheckout(), 250);
  });

  // For primary variant: wrap in a div with button + provider row + subtext
  if (!isPrimary) {
    return button;
  }

  const wrapper = document.createElement('div');
  wrapper.classList.add('checkout-cta-wrapper');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    width: 100%;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  `;

  wrapper.appendChild(button);

  // Subtext
  if (subtext) {
    const sub = document.createElement('span');
    sub.classList.add('checkout-subtext');
    sub.textContent = subtext;
    wrapper.appendChild(sub);
  }

  // Provider card
  if (providers.length > 0) {
    const providerCard = document.createElement('div');
    providerCard.classList.add('checkout-providers');

    const srOnly = document.createElement('span');
    srOnly.classList.add('sr-only');
    srOnly.textContent = 'We accept Visa, Mastercard, American Express, Discover, JCB, Affirm, Klarna, and Afterpay.';
    providerCard.appendChild(srOnly);

    const row = document.createElement('div');
    row.classList.add('checkout-providers-row');

    providers.forEach((name, i) => {
      const iconWrap = document.createElement('span');
      iconWrap.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease ${i * 30}ms;
      `;
      iconWrap.appendChild(createProviderIcon(name, 24));
      row.appendChild(iconWrap);
    });

    providerCard.appendChild(row);
    wrapper.appendChild(providerCard);
  }

  // Enter animation
  wrapper.classList.add('checkout-cta-enter');

  return wrapper;
}

export default CheckoutCTA;
