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
};

export const USER_MENU_ITEMS = [
  { title: 'My Projects', icon: folderIcon },
  { title: 'Sign Out', icon: outIcon },
  { title: 'Collaborate', icon: collaborateIcon },
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

export const RATIO_9_TO_16 = 0.5625;

export const LOADING_COLOR = '#888898';
