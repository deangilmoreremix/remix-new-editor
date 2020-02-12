import ElementsPanel from '../../components/common/Toolbar/ElementsPanel';
import MediaPanel from '../../components/common/Toolbar/MediaPanel';
import ProducePanel from '../../components/common/Toolbar/ProducePanel';

export const elementItems = [
  {
    action: () => {},
    label: 'VR Text',
    icon: '',
  },
  {
    action: () => {},
    label: 'VR Text',
    icon: '',
  },
  {
    action: () => {},
    label: 'Pop-up',
    icon: '',
  },
  {
    action: () => {},
    label: 'Google Map',
    icon: '',
  },
  {
    action: () => {},
    label: 'Image',
    icon: '',
  },
  {
    action: () => {},
    label: 'VR Image',
    icon: '',
  },
  {
    action: () => {},
    label: 'Loop',
    icon: '',
  },
  {
    action: () => {},
    label: 'Skip',
    icon: '',
  },
  {
    action: () => {},
    label: 'Pause',
    icon: '',
  },
  {
    action: () => {},
    label: 'Lead Gen',
    icon: '',
  },
  {
    action: () => {},
    label: 'Wikipedia',
    icon: '',
  },
  {
    action: () => {},
    label: '3D Model',
    icon: '',
  },
  {
    action: () => {},
    label: 'Social',
    icon: '',
  },
  {
    action: () => {},
    label: 'lower third',
    icon: '',
  },
  {
    action: () => {},
    label: 'Sketch',
    icon: '',
  },
];

export default [
  {
    key: 'media',
    label: 'Add Media',
    icon: '',
    items: MediaPanel,
  },
  {
    key: 'elements',
    label: 'Elements',
    icon: '',
    items: elementItems,
    renderer: ElementsPanel,
  },
  {
    key: 'produce',
    label: 'Produce',
    icon: '',
    items: ProducePanel,
  },
];
