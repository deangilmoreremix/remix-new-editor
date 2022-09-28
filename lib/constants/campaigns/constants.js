import svgFB from '../../../public/static/images/campaign/fb.svg';
import svgLinkedin from '../../../public/static/images/campaign/linked-in.svg';
import { styledIframe, styledIframeWithScript, emailCode } from '../../generators/iframe';

export const DEFAULT_IFRAME_SIZE = {
  width: 560,
  height: 358,
};

export const BACKEND_URL = 'https://api.vidcloud.io';
export const MIN_FANS_PAGE = 2000;
export const FB_PAGE_PERMISSIONS = 'public_profile,email,manage_pages,pages_show_list';
export const DEFAULT_PERMISSIONS = 'public_profile,email';
export const UPGRADE_URL = 'https://videoremix.io/#price-list';

export const POSTER_FRAME_RECOMMENDED_RESOLUTION = {
  width: 1200,
  height: 630,
};

export const POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT = `${POSTER_FRAME_RECOMMENDED_RESOLUTION.width}`
  + `x${POSTER_FRAME_RECOMMENDED_RESOLUTION.height}`;

export const DEFAULT = 'default';
export const EMBED_ENGINE = 'embed-engine';
export const EMBED_LOCATION = 'embed-location';
export const FACEBOOK_LOGIN = 'facebook-login';
export const FACEBOOK_PAGE = 'facebook-page';
export const FACEBOOK_POST = 'facebook-post';
export const LINKEDIN_LOGIN = 'linkedin-login';
export const LINKEDIN_POST = 'linkedin-post';
export const SERVICE_PROVIDER = 'service-provider';

export const INITIAL_LOAD = 'Initial load';

export const MESSAGE_TOPICS = {
  logIn: 'LOG_IN',
  settleAuth: 'SETTLE_AUTH',
  init: 'INIT',
  fetchUserData: 'FETCH_USER_DATA',
  fetchPagesData: 'FETCH_PAGE_DATA',
  getPageTabs: 'GET_PAGE_TABS',
  createTab: 'CREATE_TAB',
  share: 'SHARE',
};

export const FACEBOOK_SOURCE_ID = 'facebook';
export const FACEBOOK_PERMISSIONS = 'manage_pages,pages_show_list';
export const FB_DEFAULT_USERPIC = 'http://emblemsbf.com/img/11864.jpg';
export const LINKEDIN_SOURCE_ID = 'linkedin';
export const ACCESS_SCOPES = 'r_liteprofile r_emailaddress w_member_social';
export const PROFILE_FIELDS = 'id,firstName,lastName,formattedName,profilePicture(displayImage~:playableStreams)';
export const DEFAULT_USERPIC = 'http://emblemsbf.com/img/11864.jpg';
export const WORDPRESS = 'wordpress';
export const EMAIL_FRAME = 'emailFrame';

const defaultLocation = {
  key: 'default',
  label: 'Post On Social Media',
};

export const EMBED_LOCATIONS = [
  defaultLocation,
  {
    key: 'leadpages',
    label: 'LeadPages',
    prompt: 'Copy and paste this embed code into your LeadPage',
    embedGenerator: styledIframe,
  },
  {
    key: WORDPRESS,
    label: 'WordPress',
    prompt: 'Copy and paste this embed code into your WordPress',
    embedGenerator: styledIframe,
  },
  {
    key: 'optimizepress',
    label: 'OptimizePress 2.0',
    prompt: 'Copy and paste this embed code into your Video Player OP 2.0 element',
    embedGenerator: styledIframe,
  },
  {
    key: 'other',
    label: 'Other',
    prompt: 'Copy & Paste this embed code inside the custom HTML element',
    embedGenerator: styledIframe,
  },
];

export const FACEBOOK_EMBED_LOCATIONS = [
  defaultLocation,
  {
    key: 'facebook-page',
    label: 'Embed on Webpage',
  },
];

export const EMAIL_EMBED_LOCATIONS = [
  {
    key: 'default',
    label: 'Send Via AutoResponder',
  },
  {
    key: 'leadpages',
    label: 'Embed',
    prompt: 'Copy and paste this embed code into your LeadPage',
    embedGenerator: styledIframeWithScript,
  },
  {
    key: WORDPRESS,
    label: 'Embed On WordPress',
    prompt: 'Copy and paste this embed code into your WordPress',
    embedGenerator: styledIframe,
  },
  {
    key: EMAIL_FRAME,
    label: 'Send (Advanced)',
    prompt: 'Copy and paste this embed code into your email',
    embedGenerator: emailCode,
    playCheckbox: true,
  },
];

export const EMAIL_SKIP_TOKENS = [
  'GEOCOUNTRY',
  'GEOCITY',
  'GEOSTATE',
];

export const SOCIAL_SOURCES = [
  {
    key: FACEBOOK_SOURCE_ID,
    title: 'Facebook',
    image: svgFB,
  },
  {
    key: LINKEDIN_SOURCE_ID,
    title: 'LinkedIn',
    image: svgLinkedin,
  },
];
