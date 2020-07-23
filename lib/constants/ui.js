import { LIBRARY_TABS } from './library';
import { LOWER_THIRDS_TABS } from './lowerThirds';
import folderIcon from '../../public/static/svgImages/header/folder.svg';
import outIcon from '../../public/static/svgImages/header/out.svg';
import collaborateIcon from '../../public/static/svgImages/header/collaborate.svg';
import newProjectIcon from '../../public/static/svgImages/menu/new-project.svg';
import makeCopyIcon from '../../public/static/svgImages/menu/make-copy.svg';
import renameProjectIcon from '../../public/static/svgImages/menu/rename-project.svg';
import finishVideoIcon from '../../public/static/svgImages/menu/finish-video.svg';
import trashIcon from '../../public/static/svgImages/trash.svg';
import closeProjectIcon from '../../public/static/svgImages/menu/close-project.svg';
import { STICKERS_TABS } from './stickers';

export const WINDOW_TYPES = {
  SETTING: 'setting',
  ANIMATION: 'animation',
  RECORDER: 'recorder',
  ...LIBRARY_TABS,
  ...STICKERS_TABS,
  ...LOWER_THIRDS_TABS,
  CTA: 'call-to-action',
};

export const USER_MENU_ITEMS = (common) => [
  {
    title: common.whiteLabelManager.domain === 'videoremix.io' ? 'Projects and Courses' : 'Projects',
    icon: folderIcon,
    url: `${common.prefixes.projects}.${common.whiteLabelManager.domain || common.whiteLabel.devDefault}`,
  },
  { title: 'Sign Out', icon: outIcon, action: 'logout' },
  { title: 'Smart Academy', icon: collaborateIcon, url: `${common.whiteLabel.learnDefault}` },
];

export const PROJECT_MENU_ITEMS = [
  { title: 'New a project...', icon: newProjectIcon },
  { title: 'Make a copy', icon: makeCopyIcon },
  { title: 'Rename project', icon: renameProjectIcon },
  { title: 'Finish project', icon: finishVideoIcon },
  { title: 'Move to trash', icon: trashIcon },
  { title: 'Close project', icon: closeProjectIcon },
];

export const TOOLBARS = {
  MEDIA: 'media',
  ELEMENTS: 'elements',
  PRODUCE: 'produce',
};

export const PRODUCE_TABS = {
  SETTINGS: 'settings',
  PRODUCE: 'produce',
};

export const LOADING_COLOR = '#888898';
