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
      'Bounce In', 'Bounce In Down', 'Bounce In Left', 'Bounce In Right', 'Bounce In Up',
      'Fade In', 'Fade In Down', 'Fade In Down Big', 'Fade In Left', 'Fade In Left Big', 'Fade In Right', 'Fade In Right Big', 'Fade In Up', 'Fade In Up Big',
      'Flip In X', 'Flip In Y', 'Light Speed In', 'Rotate In', 'Rotate In Down Left', 'Rotate In Down Right', 'Rotate In Up Left', 'Rotate In Up Right',
      'Slide In Up', 'Slide In Down', 'Slide In Left', 'Slide In Right', 'Zoom In', 'Zoom In Down', 'Zoom In Left', 'Zoom In Right', 'Zoom In Up',
      'Jack In The Box', 'Roll In',
    ],
  },
  out: {
    types: [
      'Bounce Out', 'Bounce Out Down', 'Bounce Out Left', 'Bounce Out Right', 'Bounce Out Up',
      'Fade Out', 'Fade Out Down', 'Fade Out Down Big', 'Fade Out Left', 'Fade Out Left Big', 'Fade Out Right', 'Fade Out Right Big', 'Fade Out Up', 'Fade Out Up Big',
      'Flip Out X', 'Flip Out Y', 'Light Speed Out', 'Rotate Out', 'Rotate Out Down Left', 'Rotate Out Down Right', 'Rotate Out Up Left', 'Rotate Out Up Right',
      'Slide Out Up', 'Slide Out Down', 'Slide Out Left', 'Slide Out Right', 'Zoom Out', 'Zoom Out Down', 'Zoom Out Left', 'Zoom Out Right', 'Zoom Out Up',
      'Hinge', 'Roll Out',
    ],
  },
  idle: {
    types: [
      'Bounce', 'Flash', 'Pulse', 'Rubber Band', 'Shake', 'Swing', 'Tada', 'Wobble', 'Jello', 'Heart Beat', 'Flip',
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
