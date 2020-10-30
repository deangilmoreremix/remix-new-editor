import { POPCORN_ELEMENT_TYPES, SOCIAL_TYPES } from '../popcorn';

export const DEFAULT_HREF = 'https://www.facebook.com/facebook';
export const DEFAULT_POST_URL = 'https://www.facebook.com/20531316728/posts/10154009990506729';
export const DEFAULT_EMBED_COMMENT_URL = 'https://www.facebook.com/zuck/posts/10102577175875681?comment_id=1193531464007751&reply_comment_id=654912701278942';
export const VR_PUBLISHER_APP_ID = '1728968890675795';

export const FB_PLUGINS = {
  [SOCIAL_TYPES.FB_LIKE]: {
    title: 'Like',
    'show-faces': true,
    layout: 'standard',
    action: 'like',
    actionType: 'fb-like',
    editorWidth: 225, // should be >=225px, height is static:  35 w/o faces, 80 w/
    width: null,
    minWidth: 225,
    share: true,
    href: DEFAULT_HREF,
    type: SOCIAL_TYPES.FB_LIKE,
  },
  [SOCIAL_TYPES.FB_COMMENTS]: {
    title: 'Comments',
    actionType: 'fb-comments',
    numposts: 5,
    width: 550,
    minWidth: 320,
    maxWidth: 550,
    height: 100, // in %
    minHeight: 1, // in %
    maxHeight: 100, // in %
    href: DEFAULT_HREF,
    type: SOCIAL_TYPES.FB_COMMENTS,
  },
  [SOCIAL_TYPES.FB_COMMENTS_EMBED]: {
    title: 'Embedded Comments',
    actionType: 'fb-comment-embed',
    'include-parent': false,
    width: 560,
    maxWidth: 560,
    minWidth: 220,
    href: DEFAULT_EMBED_COMMENT_URL,
    type: SOCIAL_TYPES.FB_COMMENTS_EMBED,
  },
  [SOCIAL_TYPES.FB_POST]: {
    title: 'Post',
    actionType: 'fb-post',
    href: DEFAULT_POST_URL,
    width: 500,
    minWidth: 350,
    maxWidth: 750,
    type: SOCIAL_TYPES.FB_POST,
  },
  [SOCIAL_TYPES.FB_PAGE]: {
    title: 'Page',
    tabs: 'timeline',
    actionType: 'fb-page',
    'small-header': false,
    'adapt-container-width': true,
    'hide-cover': false,
    'show-face-pile': true,
    width: 340, // between 180 and 500
    minWidth: 180,
    maxWidth: 500,
    height: 500,
    maxHeight: 999, // Invented meaning. Anything can be here, there are no restrictions.
    minHeight: 130, // in FB docs min height is defined to be 70px,
    // but actually FB never sets it to value less than 130px
    href: DEFAULT_HREF,
    type: SOCIAL_TYPES.FB_PAGE,
  },
  defaultHrefs: [DEFAULT_EMBED_COMMENT_URL, DEFAULT_HREF, DEFAULT_POST_URL],
};

export const INITIAL_VALUES = {
  ...FB_PLUGINS[SOCIAL_TYPES.FB_LIKE],
  type: POPCORN_ELEMENT_TYPES.SOCIAL,
};
