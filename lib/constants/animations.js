import bg1Image from '../../public/static/svgImages/animate/bg-1.svg';
import bg2Image from '../../public/static/svgImages/animate/bg-2.svg';
import bg3Image from '../../public/static/svgImages/animate/bg-3.svg';
import bg4Image from '../../public/static/svgImages/animate/bg-4.svg';
import bg5Image from '../../public/static/svgImages/animate/bg-5.svg';
import bg6Image from '../../public/static/svgImages/animate/bg-6.svg';
import bg7Image from '../../public/static/svgImages/animate/bg-7.svg';
import bg8Image from '../../public/static/svgImages/animate/bg-8.svg';
import bg9Image from '../../public/static/svgImages/animate/bg-9.svg';

export const ANIMATION_TYPES = {
  IN: 'in',
  OUT: 'out',
  IDLE: 'idle',
};

export const ANIMATED_CLASS = 'animated';

export const INFINITE_CLASS = 'infinite';

export const animations = {
  [ANIMATION_TYPES.IN]: [
    { name: 'Bounce In', value: 'bounceIn', background: bg1Image },
    { name: 'Bounce In Down', value: 'bounceInDown', background: bg2Image },
    { name: 'Bounce In Left', value: 'bounceInLeft', background: bg3Image },
    { name: 'Bounce In Right', value: 'bounceInRight', background: bg4Image },
    { name: 'Bounce In Up', value: 'bounceInUp', background: bg5Image },
    { name: 'Fade In', value: 'fadeIn', background: bg6Image },
    { name: 'Fade In Down', value: 'fadeInDown', background: bg7Image },
    { name: 'Fade In Down Big', value: 'fadeInDownBig', background: bg8Image },
    { name: 'Fade In Left', value: 'fadeInLeft', background: bg9Image },
    { name: 'Fade In Left Big', value: 'fadeInLeftBig', background: bg1Image },
    { name: 'Fade In Right', value: 'fadeInRight', background: bg2Image },
    { name: 'Fade In Right Big', value: 'fadeInRightBig', background: bg3Image },
    { name: 'Fade In Up', value: 'fadeInUp', background: bg4Image },
    { name: 'Fade In Up Big', value: 'fadeInUpBig', background: bg5Image },
    { name: 'Flip In X', value: 'flipInX', background: bg6Image },
    { name: 'Flip In Y', value: 'flipInY', background: bg7Image },
    { name: 'Light Speed In', value: 'lightSpeedIn', background: bg8Image },
    { name: 'Rotate In', value: 'rotateIn', background: bg9Image },
    { name: 'Rotate In Down Left', value: 'rotateInDownLeft', background: bg1Image },
    { name: 'Rotate In Down Right', value: 'rotateInDownRight', background: bg2Image },
    { name: 'Rotate In Up Left', value: 'rotateInUpLeft', background: bg3Image },
    { name: 'Rotate In Up Right', value: 'rotateInUpRight', background: bg4Image },
    { name: 'Slide In Up', value: 'slideInUp', background: bg5Image },
    { name: 'Slide In Down', value: 'slideInDown', background: bg6Image },
    { name: 'Slide In Left', value: 'slideInLeft', background: bg7Image },
    { name: 'Slide In Right', value: 'slideInRight', background: bg8Image },
    { name: 'Zoom In', value: 'zoomIn', background: bg9Image },
    { name: 'Zoom In Down', value: 'zoomInDown', background: bg1Image },
    { name: 'Zoom In Left', value: 'zoomInLeft', background: bg2Image },
    { name: 'Zoom In Right', value: 'zoomInRight', background: bg3Image },
    { name: 'Zoom In Up', value: 'zoomInUp', background: bg4Image },
    { name: 'Jack In The Box', value: 'jackInTheBox', background: bg5Image },
    { name: 'Roll In', value: 'rollIn', background: bg6Image },
  ],
  [ANIMATION_TYPES.OUT]: [
    { name: 'Bounce Out', value: 'bounceOut', background: bg1Image },
    { name: 'Bounce Out Down', value: 'bounceOutDown', background: bg2Image },
    { name: 'Bounce Out Left', value: 'bounceOutLeft', background: bg3Image },
    { name: 'Bounce Out Right', value: 'bounceOutRight', background: bg4Image },
    { name: 'Bounce Out Up', value: 'bounceOutUp', background: bg5Image },
    { name: 'Fade Out', value: 'fadeOut', background: bg6Image },
    { name: 'Fade Out Down', value: 'fadeOutDown', background: bg7Image },
    { name: 'Fade Out Down Big', value: 'fadeOutDownBig', background: bg8Image },
    { name: 'Fade Out Left', value: 'fadeOutLeft', background: bg9Image },
    { name: 'Fade Out Left Big', value: 'fadeOutLeftBig', background: bg1Image },
    { name: 'Fade Out Right', value: 'fadeOutRight', background: bg2Image },
    { name: 'Fade Out Right Big', value: 'fadeOutRightBig', background: bg3Image },
    { name: 'Fade Out Up', value: 'fadeOutUp', background: bg4Image },
    { name: 'Fade Out Up Big', value: 'fadeOutUpBig', background: bg5Image },
    { name: 'Flip Out X', value: 'flipOutX', background: bg6Image },
    { name: 'Flip Out Y', value: 'flipOutY', background: bg7Image },
    { name: 'Light Speed Out', value: 'lightSpeedOut', background: bg8Image },
    { name: 'Rotate Out', value: 'rotateOut', background: bg9Image },
    { name: 'Rotate Out Down Left', value: 'rotateOutDownLeft', background: bg1Image },
    { name: 'Rotate Out Down Right', value: 'rotateOutDownRight', background: bg2Image },
    { name: 'Rotate Out Up Left', value: 'rotateOutUpLeft', background: bg3Image },
    { name: 'Rotate Out Up Right', value: 'rotateOutUpRight', background: bg4Image },
    { name: 'Slide Out Up', value: 'slideOutUp', background: bg5Image },
    { name: 'Slide Out Down', value: 'slideOutDown', background: bg6Image },
    { name: 'Slide Out Left', value: 'slideOutLeft', background: bg7Image },
    { name: 'Slide Out Right', value: 'slideOutRight', background: bg8Image },
    { name: 'Zoom Out', value: 'zoomOut', background: bg9Image },
    { name: 'Zoom Out Down', value: 'zoomOutDown', background: bg1Image },
    { name: 'Zoom Out Left', value: 'zoomOutLeft', background: bg2Image },
    { name: 'Zoom Out Right', value: 'zoomOutRight', background: bg3Image },
    { name: 'Zoom Out Up', value: 'zoomOutUp', background: bg4Image },
    { name: 'Hinge', value: 'hinge', background: bg5Image },
    { name: 'Roll Out', value: 'rollOut', background: bg6Image },
  ],
  [ANIMATION_TYPES.IDLE]: [
    { name: 'Bounce', value: 'bounce', background: bg1Image },
    { name: 'Flash', value: 'flash', background: bg2Image },
    { name: 'Pulse', value: 'pulse', background: bg3Image },
    { name: 'Rubber Band', value: 'rubberBand', background: bg4Image },
    { name: 'Shake', value: 'shake', background: bg5Image },
    { name: 'Swing', value: 'swing', background: bg6Image },
    { name: 'Tada', value: 'tada', background: bg7Image },
    { name: 'Wobble', value: 'wobble', background: bg8Image },
    { name: 'Jello', value: 'jello', background: bg9Image },
    { name: 'Heart Beat', value: 'heartBeat', background: bg1Image },
    { name: 'Flip', value: 'flip', background: bg2Image },
  ],
};
