// One page-scroll lock shared by every window of the landing page flow (the picker and My Video Pages), so closing one
// while the other is open keeps the page locked, and closing the last one restores what the page had before the first.
let holders = 0;
let base = '';

export function lockScroll() {
  if (holders === 0) base = document.body.style.overflow;
  holders += 1;
  document.body.style.overflow = 'hidden';
}

export function unlockScroll() {
  if (holders === 0) return;   // an unbalanced call must not restore a stale value
  holders -= 1;
  if (holders === 0) document.body.style.overflow = base;
}
