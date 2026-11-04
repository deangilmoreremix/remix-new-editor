/**
 * Overlay in / idle / out animations for the Remotion engine.
 *
 * The editor's DOM preview uses Animate.css class names (upstream's
 * lib/constants/animations.js). The web renderer draws frames itself, so
 * keyframe CSS animations don't apply; this computes the same motion as
 * inline opacity/transform values for a given frame.
 */

const ANIM_FRAMES = 24; // ~0.8 s at 30 fps, matching .animated duration

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** Direction suffix → unit vector the element comes FROM (in %). */
function fromOffset(name, big) {
  const d = big ? 140 : 60;
  if (/Down/.test(name)) return [0, -d];
  if (/Up/.test(name)) return [0, d];
  if (/Left/.test(name)) return [-d, 0];
  if (/Right/.test(name)) return [d, 0];
  return [0, 0];
}

/**
 * Pose for an entrance animation at progress p (0 = start, 1 = rest).
 * Returns { opacity, tx, ty, scale, rotate, rotateX, rotateY, skewX }.
 */
export function entrancePose(name, p) {
  const t = clamp01(p);
  const pose = { opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0, skewX: 0 };
  if (!name) return pose;
  const e = easeOut(t);
  const big = /Big/.test(name);
  if (/^fadeIn/.test(name)) {
    const [x, y] = fromOffset(name, big);
    Object.assign(pose, { opacity: e, tx: x * (1 - e), ty: y * (1 - e) });
  } else if (/^slideIn/.test(name)) {
    const [x, y] = fromOffset(name, true);
    Object.assign(pose, { tx: x * (1 - e), ty: y * (1 - e) });
  } else if (/^bounceIn/.test(name)) {
    const b = easeOutBack(t);
    if (name === 'bounceIn') Object.assign(pose, { opacity: e, scale: 0.3 + 0.7 * b });
    else {
      const [x, y] = fromOffset(name, true);
      Object.assign(pose, { opacity: e, tx: x * (1 - b), ty: y * (1 - b) });
    }
  } else if (/^zoomIn/.test(name)) {
    const [x, y] = fromOffset(name, true);
    Object.assign(pose, { opacity: e, scale: 0.3 + 0.7 * e, tx: x * (1 - e), ty: y * (1 - e) });
  } else if (name === 'flipInX') Object.assign(pose, { opacity: e, rotateX: 90 * (1 - e) });
  else if (name === 'flipInY') Object.assign(pose, { opacity: e, rotateY: 90 * (1 - e) });
  else if (/^rotateIn/.test(name)) {
    const deg = name === 'rotateIn' ? -200 : /UpRight/.test(name) ? -90 : /DownRight|UpLeft/.test(name) ? 45 : -45;
    Object.assign(pose, { opacity: e, rotate: deg * (1 - e) });
  } else if (name === 'lightSpeedIn') Object.assign(pose, { opacity: e, tx: 100 * (1 - e), skewX: -30 * (1 - e) });
  else if (name === 'jackInTheBox') Object.assign(pose, { opacity: e, scale: 0.1 + 0.9 * easeOutBack(t), rotate: 30 * (1 - e) });
  else if (name === 'rollIn') Object.assign(pose, { opacity: e, tx: -100 * (1 - e), rotate: -120 * (1 - e) });
  else pose.opacity = e;
  return pose;
}

/** Exit animations are the entrance run backwards, with Out→In names. */
export function exitPose(name, p) {
  if (!name) return entrancePose(null, 1);
  if (name === 'hinge') {
    const t = clamp01(p);
    return { ...entrancePose(null, 1), rotate: 80 * Math.min(1, t * 2), ty: t > 0.6 ? (t - 0.6) * 500 : 0, opacity: 1 - clamp01((t - 0.6) / 0.4) };
  }
  const inName = name === 'rollOut' ? 'rollIn' : name.replace('Out', 'In')
    // An exit "Down" moves down: the same as an entrance coming from below.
    .replace(/In(Down)/, 'In_UP_').replace(/In(Up)/, 'InDown').replace('In_UP_', 'InUp');
  return entrancePose(inName, 1 - clamp01(p));
}

/** Looping idle motion at time f frames (fps-independent shapes). */
export function idlePose(name, f, fps = 30) {
  const pose = entrancePose(null, 1);
  if (!name) return pose;
  const s = f / fps;
  const w = (period) => Math.sin((s / period) * Math.PI * 2);
  switch (name) {
    case 'pulse': pose.scale = 1 + 0.05 * (0.5 + 0.5 * w(1)); break;
    case 'bounce': pose.ty = -12 * Math.abs(w(1)); break;
    case 'flash': pose.opacity = 0.5 + 0.5 * Math.cos((s / 1) * Math.PI * 4); break;
    case 'shake': pose.tx = 4 * w(0.2); break;
    case 'swing': pose.rotate = 10 * w(1); break;
    case 'tada': pose.scale = 1 + 0.06 * Math.abs(w(1)); pose.rotate = 3 * w(0.25); break;
    case 'wobble': pose.tx = 8 * w(1); pose.rotate = 3 * w(1); break;
    case 'rubberBand': pose.scale = 1 + 0.08 * w(0.8); break;
    case 'jello': pose.skewX = 6 * w(0.9) * Math.max(0, Math.cos((s % 1) * Math.PI)); break;
    case 'heartBeat': pose.scale = 1 + 0.2 * Math.max(0, w(1.3)) ** 6; break;
    case 'flip': pose.rotateY = (s % 1) * 360; break;
    default: break;
  }
  return pose;
}

/**
 * Inline style for an overlay at `frame` (relative to its own start) with
 * `animation` = { in, idle, out } and `transition` (image overlays'
 * popcorn-fade etc.).
 */
export function animationStyle({ animation, transition } = {}, frame, durationInFrames, fps = 30, baseRotation = 0) {
  const a = animation || {};
  let inName = a.in;
  if (!inName && transition && transition !== 'popcorn-none') {
    inName = {
      'popcorn-fade': 'fadeIn', 'popcorn-fade-in': 'fadeIn', 'popcorn-fade-in-up': 'fadeInUp', 'popcorn-pop': 'bounceIn',
      'popcorn-slide-up': 'slideInUp', 'popcorn-slide-down': 'slideInDown', 'popcorn-pan-zoom': null,
    }[transition] || 'fadeIn';
  }
  const len = Math.min(ANIM_FRAMES, Math.floor(durationInFrames / 2));
  let pose;
  if (inName && frame < len) pose = entrancePose(inName, frame / len);
  else if (a.out && frame >= durationInFrames - len) pose = exitPose(a.out, (frame - (durationInFrames - len)) / len);
  else pose = idlePose(a.idle, frame - (inName ? len : 0), fps);
  // Pan & zoom (image transition): slow push-in over the whole clip.
  const panZoom = transition === 'popcorn-pan-zoom' ? 1 + 0.15 * clamp01(frame / Math.max(1, durationInFrames)) : 1;
  const parts = [];
  if (pose.tx || pose.ty) parts.push(`translate(${pose.tx}%, ${pose.ty}%)`);
  if (baseRotation || pose.rotate) parts.push(`rotate(${baseRotation + pose.rotate}deg)`);
  if (pose.rotateX) parts.push(`perspective(800px) rotateX(${pose.rotateX}deg)`);
  if (pose.rotateY) parts.push(`perspective(800px) rotateY(${pose.rotateY}deg)`);
  if (pose.skewX) parts.push(`skewX(${pose.skewX}deg)`);
  if (pose.scale * panZoom !== 1) parts.push(`scale(${pose.scale * panZoom})`);
  return { opacity: pose.opacity, transform: parts.join(' ') || undefined };
}
