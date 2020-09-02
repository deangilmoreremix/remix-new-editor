import { LIBRARY_TABS } from './library';
import { LOWER_THIRDS_TABS } from './lowerThirds';
import folderIcon from '../../public/static/svgImages/header/folder.svg';
import outIcon from '../../public/static/svgImages/header/out.svg';
import collaborateIcon from '../../public/static/svgImages/header/collaborate.svg';
import newProjectIcon from '../../public/static/svgImages/menu/new-project.svg';
import makeCopyIcon from '../../public/static/svgImages/menu/make-copy.svg';
import renameProjectIcon from '../../public/static/svgImages/menu/rename-project.svg';
import watchVideoIcon from '../../public/static/svgImages/menu/watch-video.svg';
import archiveIcon from '../../public/static/svgImages/menu/archive.svg';
import { STICKERS_TABS } from './stickers';
import { JSON_TRANSITION_TABS } from './jsonTransition';
import saveAsIcon from '../../public/static/svgImages/menu/save-as.svg';
import { SAVE_PROJECT_MODAL } from './modals';

export const WINDOW_TYPES = {
  SETTING: 'setting',
  ANIMATION: 'animation',
  RECORDER: 'recorder',
  ...LIBRARY_TABS,
  ...STICKERS_TABS,
  ...LOWER_THIRDS_TABS,
  CTA: 'call-to-action',
  BLEND_MODE_LIBRARY: 'blend-mode-library',
  GIF: 'gif',
  STICKER: 'sticker',
};

export const SCREEN_RATIO = {
  ...JSON_TRANSITION_TABS,
};

export const ACTION_LOGOUT = 'logout';
export const ACTION_NEW_PROJECT = 'new_project';
export const ACTION_MAKE_COPY = 'make_copy';
export const ACTION_RENAME_PROJECT = 'rename_project';
export const ACTION_WATCH_VIDEO = 'watch_video';
export const ACTION_ARCHIVE = 'archive';
export const ACTION_SAVE_PROJECT = 'save_project';

export const USER_MENU_ITEMS = (common) => [
  {
    title: common.whiteLabelManager.domain === 'videoremix.io' ? 'Projects and Courses' : 'Projects',
    icon: folderIcon,
    url: `${common.prefixes.projects}.${common.whiteLabelManager.domain || common.whiteLabel.devDefault}`,
  },
  { title: 'Sign Out', icon: outIcon, action: ACTION_LOGOUT },
  { title: 'Smart Academy', icon: collaborateIcon, url: `${common.whiteLabel.learnDefault}` },
];

export const SIDEBAR_MENU_ITEMS = (modified, common, isSuperAdmin) => [
  { title: 'Save', icon: saveAsIcon, action: ACTION_SAVE_PROJECT },
  { title: 'Save as', icon: saveAsIcon, action: SAVE_PROJECT_MODAL, display: isSuperAdmin },
  { title: 'Rename the project', icon: renameProjectIcon, action: ACTION_RENAME_PROJECT },
  { title: 'Create a new project', icon: newProjectIcon, action: ACTION_NEW_PROJECT },
  { title: 'Make a copy', icon: makeCopyIcon, action: ACTION_MAKE_COPY },
  { title: 'Watch the video', icon: watchVideoIcon, action: ACTION_WATCH_VIDEO },
  {
    title: 'Archive',
    icon: archiveIcon,
    action: ACTION_ARCHIVE,
    disabled: modified,
    url: `${common.prefixes.projects}.${common.whiteLabelManager.domain || common.whiteLabel.devDefault}`,
  },
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
