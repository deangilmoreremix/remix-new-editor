// CheckoutCTA — contextual video-section checkout button.
//
// Renders a brand-aligned gradient CTA that accepts a dynamic `offer`
// object so each video section can name exactly what the user just watched.
// Includes payment provider icons (monochrome) and Stripe redirect.
//
// Usage:
//   const el = CheckoutCTA({
//     variant: 'primary',   // or 'inline'
//     offer: {
//       id: 'cinematic-trailers',
//       headline: 'AI Cinematic Trailers',
//       description: 'Turn any script into a movie-quality trailer.',
//       cta: 'Get AI cinematic trailers',
//     },
//     providers: ['visa','mastercard','amex','discover','jcb','affirm','klarna','afterpay'],
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
let rippleStylesInjected = false;

function injectGlobalStyles() {
  if (rippleStylesInjected) return;
  rippleStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes checkout-ripple-anim {
      0% { transform: scale(0); opacity: 0.6; }
      100% { transform: scale(4); opacity: 0; }
    }
    .checkout-cta {
      -webkit-tap-highlight-color: transparent;
    }
    .checkout-cta:active:not(:disabled) {
      transform: scale(0.98);
    }
    .checkout-cta--primary:active:not(:disabled) {
      transform: scale(0.98);
    }
    .checkout-cta--inline:active:not(:disabled) {
      transform: scale(0.98);
    }
    .provider-icon {
      flex-shrink: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0.75;
    }
    .checkout-cta:hover .provider-icon {
      opacity: 1;
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
    symbol.setAttribute('viewBox', name === 'mastercard' || name === 'jcb' ? '0 0 24 24' : '0 0 24 24');
    symbol.innerHTML = path;
    svg.appendChild(symbol);
  }

  document.body.appendChild(svg);
}

function createProviderIcon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${size}px`);
  svg.setAttribute('height', `${size}px`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('provider-icon');

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

function CheckoutCTA({ variant = 'primary', offer = {}, providers = [], onCheckout = () => {} }) {
  const isPrimary = variant === 'primary';
  const {
    id = 'checkout',
    headline = '',
    description = '',
    cta = 'Get started',
    icon = '',
  } = offer;

  injectGlobalStyles();
  injectProviderSymbols();

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-checkout-cta', id);
  button.setAttribute('aria-label', cta);
  button.classList.add('checkout-cta', isPrimary ? 'checkout-cta--primary' : 'checkout-cta--inline');

  if (isPrimary) {
    button.classList.add(
      'group',
      'inline-flex',
      'flex-col',
      'items-start',
      'justify-between',
      'gap-3',
      'w-full',
      'max-w-xl',
      'mx-auto',
      'px-8',
      'md:px-12',
      'py-5',
      'rounded-2xl',
      'bg-gradient-to-r',
      'from-cyan-400',
      'to-emerald-400',
      'text-[#020205]',
      'font-bold',
      'leading-tight',
      'shadow-2xl',
      'shadow-cyan-400/40',
      'transition-all',
      'duration-300',
      'ease-out',
      'hover:from-cyan-300',
      'hover:to-emerald-300',
      'hover:shadow-cyan-300/60',
      'hover:scale-[1.03]',
      'focus:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-cyan-400',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-[#020205]',
      'relative',
      'overflow-hidden',
      'cursor-pointer'
    );
  } else {
    button.classList.add(
      'group',
      'inline-flex',
      'items-center',
      'justify-center',
      'gap-2',
      'w-full',
      'px-6',
      'py-4',
      'rounded-xl',
      'bg-gradient-to-r',
      'from-cyan-400',
      'to-emerald-400',
      'text-[#020205]',
      'font-bold',
      'text-base',
      'shadow-lg',
      'shadow-cyan-400/25',
      'transition-all',
      'duration-300',
      'hover:from-cyan-300',
      'hover:to-emerald-300',
      'hover:shadow-cyan-400/40',
      'hover:scale-[1.02]',
      'focus:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-cyan-400',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-[#020205]',
      'relative',
      'overflow-hidden',
      'cursor-pointer'
    );
  }

  // Text block (primary only shows headline + description)
  if (isPrimary) {
    const textBlock = document.createElement('div');
    textBlock.classList.add('flex', 'flex-col', 'gap-1', 'w-full');

    const headlineEl = document.createElement('span');
    headlineEl.classList.add(
      'flex',
      'items-center',
      'gap-2',
      'font-bold',
      'tracking-tight',
      'truncate',
      'text-lg'
    );

    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.classList.add('flex-shrink-0');
      iconSpan.innerHTML = icon;
      iconSpan.setAttribute('aria-hidden', 'true');
      headlineEl.appendChild(iconSpan);
    }

    const headlineText = document.createElement('span');
    headlineText.textContent = cta;
    headlineEl.appendChild(headlineText);
    textBlock.appendChild(headlineEl);

    if (description) {
      const descEl = document.createElement('span');
      descEl.classList.add(
        'text-sm',
        'text-[#020205]/70',
        'font-medium',
        'truncate'
      );
      descEl.textContent = description;
      textBlock.appendChild(descEl);
    }

    button.appendChild(textBlock);
  } else {
    // Inline: simple centered text + arrow
    const textWrap = document.createElement('span');
    textWrap.classList.add('flex', 'items-center', 'justify-center', 'gap-2');

    const textNode = document.createTextNode(cta);
    textWrap.appendChild(textNode);

    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.classList.add(
      'transition-transform',
      'duration-300',
      'group-hover:translate-x-1',
      'flex-shrink-0'
    );
    arrow.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>`;

    textWrap.appendChild(arrow);
    button.appendChild(textWrap);
  }

  // Arrow for primary (right side)
  if (isPrimary) {
    const arrowWrap = document.createElement('span');
    arrowWrap.classList.add(
      'flex-shrink-0',
      'self-end',
      'transition-transform',
      'duration-300',
      'group-hover:translate-x-1'
    );
    arrowWrap.setAttribute('aria-hidden', 'true');
    arrowWrap.innerHTML = `
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
      </svg>
    `;
    button.appendChild(arrowWrap);
  }

  // Provider section (primary only)
  if (isPrimary && providers.length > 0) {
    const providerWrap = document.createElement('div');
    providerWrap.classList.add(
      'mt-3',
      'pt-3',
      'border-t',
      'border-[#020205]/15',
      'flex',
      'flex-col',
      'gap-2',
      'w-full'
    );

    const srOnly = document.createElement('span');
    srOnly.classList.add('sr-only');
    srOnly.textContent = 'We accept Visa, Mastercard, American Express, Discover, JCB, Affirm, Klarna, and Afterpay.';
    providerWrap.appendChild(srOnly);

    const cardsRow = document.createElement('div');
    cardsRow.classList.add('flex', 'flex-wrap', 'items-center', 'gap-x-3', 'gap-y-1');
    ['visa', 'mastercard', 'amex', 'discover', 'jcb'].forEach((name, i) => {
      if (providers.includes(name)) {
        const iconWrap = document.createElement('span');
        iconWrap.classList.add('provider-icon-wrap', 'inline-flex', 'items-center');
        iconWrap.appendChild(createProviderIcon(name, 22));
        cardsRow.appendChild(iconWrap);
      }
    });

    const bnplRow = document.createElement('div');
    bnplRow.classList.add('flex', 'flex-wrap', 'items-center', 'gap-x-3', 'gap-y-1');
    ['affirm', 'klarna', 'afterpay'].forEach((name, i) => {
      if (providers.includes(name)) {
        const iconWrap = document.createElement('span');
        iconWrap.classList.add('provider-icon-wrap', 'inline-flex', 'items-center');
        iconWrap.appendChild(createProviderIcon(name, 22));
        bnplRow.appendChild(iconWrap);
      }
    });

    providerWrap.appendChild(cardsRow);
    providerWrap.appendChild(bnplRow);
    button.appendChild(providerWrap);

    // Hover stagger on provider icons
    button.addEventListener('mouseenter', () => {
      providerWrap.querySelectorAll('.provider-icon').forEach((icon, i) => {
        icon.style.transitionDelay = `${i * 40}ms`;
        icon.style.transform = 'translateY(-2px)';
      });
    });
    button.addEventListener('mouseleave', () => {
      providerWrap.querySelectorAll('.provider-icon').forEach((icon) => {
        icon.style.transitionDelay = '0ms';
        icon.style.transform = 'translateY(0)';
      });
    });
  }

  // Shimmer sweep on hover (primary only)
  if (isPrimary) {
    const shimmer = document.createElement('span');
    shimmer.setAttribute('aria-hidden', 'true');
    shimmer.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.05) 50%, transparent 54%);
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
      z-index: 1;
    `;
    button.appendChild(shimmer);

    button.addEventListener('mouseenter', () => { shimmer.style.opacity = '1'; });
    button.addEventListener('mouseleave', () => { shimmer.style.opacity = '0'; });
  }

  // Click handler with ripple + redirect
  button.addEventListener('click', (event) => {
    createRippleEffect(button, event);
    setTimeout(() => onCheckout(), 250);
  });

  return button;
}

export default CheckoutCTA;
