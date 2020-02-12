import ElementsPanel from '../../components/common/Toolbar/ElementsPanel';
import MediaPanel from '../../components/common/Toolbar/MediaPanel';
import ProducePanel from '../../components/common/Toolbar/ProducePanel';

import svg3D from '../../public/images/toolbar/3D.svg';
import svgAddMedia from '../../public/images/toolbar/addMedia.svg';
import svgElements from '../../public/images/toolbar/elements.svg';
import svgImage from '../../public/images/toolbar/image.svg';
import svgLeadGen from '../../public/images/toolbar/leadGen.svg';
import svgLoop from '../../public/images/toolbar/loop.svg';
import svgLowerThirds from '../../public/images/toolbar/lowerThirds.svg';
import svgMaps from '../../public/images/toolbar/maps.svg';
import svgPause from '../../public/images/toolbar/pause.svg';
import svgPopUp from '../../public/images/toolbar/popUp.svg';
import svgProduce from '../../public/images/toolbar/produce.svg';
import svgSketchEditor from '../../public/images/toolbar/sketchEditor.svg';
import svgSkip from '../../public/images/toolbar/skip.svg';
import svgSocial from '../../public/images/toolbar/social.svg';
import svgTextMask from '../../public/images/toolbar/textMask.svg';
import svgVRImage from '../../public/images/toolbar/vrImage.svg';
import svgVRText from '../../public/images/toolbar/vrText.svg';
import svgWiki from '../../public/images/toolbar/wiki.svg';

export const elementItems = [
  {
    action: () => {},
    label: 'VR Text',
    icon: svgVRText,
    disabled: true,
    visible: true,
  },
  {
    action: () => {},
    label: 'Text Mask',
    icon: svgTextMask,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Pop-up',
    icon: svgPopUp,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Google Map',
    icon: svgMaps,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Image',
    icon: svgImage,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'VR Image',
    icon: svgVRImage,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Loop',
    icon: svgLoop,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Skip',
    icon: svgSkip,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Pause',
    icon: svgPause,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Lead Gen',
    icon: svgLeadGen,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Wikipedia',
    icon: svgWiki,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: '3D Model',
    icon: svg3D,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Social',
    icon: svgSocial,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'lower third',
    icon: svgLowerThirds,
    disabled: false,
    visible: true,
  },
  {
    action: () => {},
    label: 'Sketch',
    icon: svgSketchEditor,
    disabled: false,
    visible: true,
  },
];

export default [
  {
    key: 'media',
    label: 'Add Media',
    icon: svgAddMedia,
    items: [],
    renderer: MediaPanel,
  },
  {
    key: 'elements',
    label: 'Elements',
    icon: svgElements,
    items: elementItems,
    renderer: ElementsPanel,
  },
  {
    key: 'produce',
    label: 'Produce',
    icon: svgProduce,
    items: [],
    renderer: ProducePanel,
  },
];
