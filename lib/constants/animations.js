import bg1Image from '../../public/static/svgImages/animate/bg-1.svg';
import bg2Image from '../../public/static/svgImages/animate/bg-2.svg';
import bg3Image from '../../public/static/svgImages/animate/bg-3.svg';
import bg4Image from '../../public/static/svgImages/animate/bg-4.svg';
import bg5Image from '../../public/static/svgImages/animate/bg-5.svg';
import bg6Image from '../../public/static/svgImages/animate/bg-6.svg';
import bg7Image from '../../public/static/svgImages/animate/bg-7.svg';
import bg8Image from '../../public/static/svgImages/animate/bg-8.svg';
import bg9Image from '../../public/static/svgImages/animate/bg-9.svg';

export const animations = {
  in: {
    types: [
      'bounceIn', 'bounceInDown', 'bounceInLeft', 'bounceInRight', 'bounceInUp',
      'fadeIn', 'fadeInDown', 'fadeInDownBig', 'fadeInLeft', 'fadeInLeftBig', 'fadeInRight', 'fadeInRightBig', 'fadeInUp', 'fadeInUpBig',
      'flipInX', 'flipInY', 'lightSpeedIn', 'rotateIn', 'rotateInDownLeft', 'rotateInDownRight', 'rotateInUpLeft', 'rotateInUpRight',
      'slideInUp', 'slideInDown', 'slideInLeft', 'slideInRight', 'zoomIn', 'zoomInDown', 'zoomInLeft', 'zoomInRight', 'zoomInUp',
      'jackInTheBox', 'rollIn',
    ],
  },
  out: {
    types: [
      'bounceOut', 'bounceOutDown', 'bounceOutLeft', 'bounceOutRight', 'bounceOutUp',
      'fadeOut', 'fadeOutDown', 'fadeOutDownBig', 'fadeOutLeft', 'fadeOutLeftBig', 'fadeOutRight', 'fadeOutRightBig', 'fadeOutUp', 'fadeOutUpBig',
      'flipOutX', 'flipOutY', 'lightSpeedOut', 'rotateOut', 'rotateOutDownLeft', 'rotateOutDownRight', 'rotateOutUpLeft', 'rotateOutUpRight',
      'slideOutUp', 'slideOutDown', 'slideOutLeft', 'slideOutRight', 'zoomOut', 'zoomOutDown', 'zoomOutLeft', 'zoomOutRight', 'zoomOutUp',
      'hinge', 'rollOut',
    ],
  },
  idle: {
    types: [
      'bounce', 'flash', 'pulse', 'rubberBand', 'shake', 'swing', 'tada', 'wobble', 'jello', 'heartBeat', 'flip',
    ],
  },
};

export const animationsBg = [
  bg9Image,
  bg8Image,
  bg7Image,
  bg6Image,
  bg5Image,
  bg4Image,
  bg3Image,
  bg2Image,
  bg1Image,
];
