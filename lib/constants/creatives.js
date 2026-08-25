import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import userIcon from '../../public/static/svgImages/user.svg';
import audioLibraryIcon from '../../public/static/svgImages/audio-library.svg';
import voiceIcon from '../../public/static/images/media/voice.svg';
import lowerThirdIcon from '../../public/static/images/toolbar/lowerthird.svg';
import ctaIcon from '../../public/static/images/toolbar/call-to-action.svg';
import blendModeIcon from '../../public/static/images/toolbar/blendModes.svg';
import imageLTIcon from '../../public/static/images/toolbar/imageLT.svg';
import neonLTIcon from '../../public/static/images/toolbar/neonSocialMediaLT.svg';
import neonArrowPackIcon from '../../public/static/images/toolbar/neonArrowPack.svg';
import socialMediaPackIcon from '../../public/static/images/toolbar/socialMediaPack.svg';
import socialMediaButtonPackIcon from '../../public/static/images/toolbar/socialMediaButtonPack.svg';
import locationTitlesIcon from '../../public/static/images/toolbar/location-titles.svg';
import callOutTitlePackageIcon from '../../public/static/images/toolbar/call-out.svg';
import socialMedia3DIcon from '../../public/static/images/toolbar/3D-social-media.svg';
import retroLTIcon from '../../public/static/images/toolbar/RetroLT.svg';
import overlaysIcon from '../../public/static/images/toolbar/overlays.svg';
import endScreensIcon from '../../public/static/images/toolbar/endScreen.svg';
import connectFormIcon from '../../public/static/images/toolbar/connect.svg';

import LTIcon from '../../public/static/images/toolbar/LT.svg';
import txtVideoIcon from '../../public/static/svgImages/txtVideo.svg';
import dropMockIcon from '../../public/static/svgImages/dropMock.svg';
import videoIcon from '../../public/static/images/media/media-video.svg';
import imageIcon from '../../public/static/images/media/media-image.svg';
import secondaryImageIcon from '../../public/static/images/media/media-image-2.svg';
import musicIcon from '../../public/static/images/media/media-music.svg';
import freeSoundIcon from '../../public/static/images/media/freesound.svg';
// import templateIcon from '../../public/static/images/media/media-template.svg';
import personalizedVoiceIcon from '../../public/static/images/media/personalized-voice.svg';
import { ASSET_TYPES, REMOTE_ASSET_TYPES } from './media';
import { mediaTooltips } from './tooltips';

export const perPage = 15;

export const CREATIVE_KEYS = {
  USER: 'USER',
  LOWER_THIRDS: 'LOWER_THIRDS',
  LT_PRESETS: 'LT_PRESETS',
  IMAGE_LT_PRESETS: 'IMAGE_LT_PRESETS',
  NEON_SOCIAL_MEDIA_LT: 'NEON_SOCIAL_MEDIA_LT',
  NEON_LT: 'NEON_LT',
  END_SCREENS: 'END_SCREENS',
  CONNECT_FORM: 'CONNECT_FORM',
  LOCATION_TITLE: 'LOCATION_TITLE',
  SOCIAL_MEDIA_ICON: 'SOCIAL_MEDIA_ICON',
  CALL_OUT_TITLE_PACKAGE: 'CALL_OUT_TITLE_PACKAGE',
  CTA: 'CTA',
  BLAND_MODES: 'BLAND_MODES',
  OVERLAYS: 'OVERLAYS',
  NEON_ARROW_PACK: 'NEON_ARROW_PACK',
  SOCIAL_MEDIA_PACK: 'SOCIAL_MEDIA_PACK',
  SOCIAL_MEDIA_BUTTON_PACK: 'SOCIAL_MEDIA_BUTTON_PACK'

};
export const lowerThirdList = [
  {
    id: 0,
    key: 'LowerThird',
    name: 'Lower Thirds',
    icon: lowerThirdIcon
  },
  {
    id: 1,
    key: 'LTPreset',
    name: 'LT presets',
    icon: LTIcon
  },
  {
    id: 2,
    key: 'ImageLT',
    name: 'Image LT Presets',
    icon: imageLTIcon
  },
  {
    id: 3,
    key: 'RetroLT',
    name: 'Retro LT',
    icon: retroLTIcon
  },
  {
    id: 4,
    key: 'NeonLT',
    name: 'Neon LT',
    icon: neonLTIcon
  },
  {
    id: 5,
    key: 'NeonSocialMediaLT',
    name: 'Neon Social Media LT',
    icon: neonLTIcon
  },
  {
    id: 6,
    key: 'SocialMediaLT',
    name: 'Social Media LT',
    icon: neonLTIcon
  },
  {
    id: 7,
    key: 'Music',
    name: 'Music',
    icon: neonLTIcon
  },
  {
    id: 8,
    key: 'Quotes',
    name: 'Quotes',
    icon: neonLTIcon
  },

]
export const STEPS = {
  LOWERTHIRD: 0,
  CTA: 1,
  TEMPLATEPACK: 2,
};
export const ctaList = [
  {
    id: 0,
    key: 'CTA',
    name: 'CTA',
    icon: ctaIcon
  },
  {
    id: 1,
    key: 'BlendModes',
    name: 'Blend Modes',
    icon: blendModeIcon
  },
  {
    id: 2,
    key: 'Overlays',
    name: 'Overlays',
    icon: overlaysIcon
  },
  {
    id: 3,
    key: 'NeonArrowPack',
    name: 'Neon Arrow Pack',
    icon: neonArrowPackIcon
  },
  {
    id: 4,
    key: 'LocationTitles',
    name: 'Location Titles',
    icon: locationTitlesIcon
  }, 
  {
    id: 5,
    key: 'CallOutTitlePackage',
    name: 'Call Out Title Package',
    icon: callOutTitlePackageIcon
  },
  
  {
    id: 6,
    key: 'CountDownTimer',
    name: 'Count Down Timer',
    icon: socialMediaButtonPackIcon
  },
  {
    id: 7,
    key: 'PriceTags',
    name: 'Price Tags',
    icon: socialMediaButtonPackIcon
  },
  {
    id: 8,
    key: 'SocialMediaIcon3D',
    name: '3D Social Media Icons',
    icon: socialMedia3DIcon
  }
]
export const templatePackList = [
  {
    id: 0,
    key: 'ConnectForm',
    name: 'Connect Form',
    icon: connectFormIcon
  },
  {
    id: 1,
    key: 'EndScreens',
    name: 'Interactive Video Outros',
    icon: endScreensIcon
  },
  {
    id: 2,
    key: 'SocialMediaPack',
    name: 'Social Media Pack',
    icon: socialMediaPackIcon
  },
  {
    id: 3,
    key: 'SocialMediaButtonPack',
    name: 'Social Media Button Pack',
    icon: socialMediaButtonPackIcon
  },
  {
    id: 4,
    key: 'Ecommerce',
    name: 'Ecommerce',
    icon: callOutTitlePackageIcon
  },
  {
    id: 5,
    key: 'SMPvpBunble',
    name: 'SM PVP Bundle',
    icon: callOutTitlePackageIcon
  },
  {
    id: 6,
    key: 'GreatTechLayoff',
    name: 'Great Tech Layoff',
    icon: callOutTitlePackageIcon
  },
  {
    id: 7,
    key: 'YouTubeInterActive',
    name: 'YouTube Interactive',
    icon: callOutTitlePackageIcon
  },
  {
    id: 8,
    key: 'MillionDollarHack',
    name: 'Million Dollar Hack',
    icon: callOutTitlePackageIcon
  }
]
export const creativeProviders = (common) => {
  if (!common) {
    throw new Error('Not enough parameters to create Media Providers');
  }

  return {
    [CREATIVE_KEYS.LOWER_THIRDS]: {
      name: 'LowerThird',
      icon: lowerThirdIcon,
    },
    [CREATIVE_KEYS.LT_PRESETS]: {
      name: 'LT presets',
      icon: lowerThirdIcon,

    },
    [CREATIVE_KEYS.IMAGE_LT_PRESETS]: {
      name: 'Image LT Presets',
      icon: lowerThirdIcon,

    }
    // return {
    //   [LIBRARY_KEYS.USER]: {
    //     name: 'My',
    //     icon: userIcon,
    //     apiPath: 'api/users/me/media-assets',
    //     apiUrl: common.backend.url,
    //     supportedMedia: [
    //       ASSET_TYPES.IMAGE,
    //       ASSET_TYPES.VIDEO,
    //       ASSET_TYPES.AUDIO,
    //       ASSET_TYPES.VOICE,
    //       ASSET_TYPES.PERSONALIZED_VOICE,
    //     ],
    //   },
    //   [LIBRARY_KEYS.VOICE]: {
    //     name: 'Voice',
    //     icon: voiceIcon,
    //     apiPath: 'api/users/me/media-assets',
    //     apiUrl: common.backend.url,
    //     supportedMedia: [
    //       ASSET_TYPES.VOICE,
    //     ],
    //   },
    //   [LIBRARY_KEYS.PERSONALIZED_VOICE]: {
    //     name: 'Personalized voice',
    //     icon: personalizedVoiceIcon,
    //     apiPath: 'api/users/me/media-assets',
    //     apiUrl: common.backend.url,
    //     supportedMedia: [
    //       ASSET_TYPES.PERSONALIZED_VOICE,
    //     ],
    //   },
    //   [LIBRARY_KEYS.PIXABAY]: {
    //     name: 'Pixabay',
    //     icon: pixabayIcon,
    //     apiUrl: common.mediaProviders.PIXABAY.apiUrl,
    //     videosApiPath: common.mediaProviders.PIXABAY.videosApiPath,
    //     imagesApiPath: common.mediaProviders.PIXABAY.imagesApiPath,
    //     apiKey: common.mediaProviders.PIXABAY.apiKey,
    //     supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    //   },
    //   [LIBRARY_KEYS.UNSPLASH]: {
    //     name: 'Unsplash',
    //     icon: unsplashIcon,
    //     apiUrl: common.mediaProviders.UNSPLASH.apiUrl,
    //     imagesApiPath: common.mediaProviders.UNSPLASH.imagesApiPath,
    //     apiKey: common.mediaProviders.UNSPLASH.apiKey,
    //     supportedMedia: [ASSET_TYPES.IMAGE],
    //   },
    //   [LIBRARY_KEYS.PEXELS]: {
    //     name: 'Pexels',
    //     icon: pexelsIcon,
    //     apiUrl: common.mediaProviders.PEXELS.apiUrl,
    //     videosApiPath: common.mediaProviders.PEXELS.videosApiPath,
    //     imagesApiPath: common.mediaProviders.PEXELS.imagesApiPath,
    //     apiKey: common.mediaProviders.PEXELS.apiKey,
    //     supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    //   },
    //   [LIBRARY_KEYS.DROPMOCK]: {
    //     name: 'Dropmock',
    //     icon: dropMockIcon,
    //     apiUrl: common.mediaProviders.DROPMOCK.apiUrl,
    //     videosApiPath: common.mediaProviders.DROPMOCK.videosApiPath,
    //     imagesApiPath: common.mediaProviders.DROPMOCK.imagesApiPath,
    //     apiKey: common.mediaProviders.DROPMOCK.apiKey,
    //     supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    //   },
    //   [LIBRARY_KEYS.TXTVIDEO]: {
    //     name: 'TXT Video',
    //     icon: txtVideoIcon,
    //     apiUrl: common.mediaProviders.TXTVIDEO.apiUrl,
    //     videosApiPath: common.mediaProviders.TXTVIDEO.videosApiPath,
    //     apiKey: common.mediaProviders.TXTVIDEO.apiKey,
    //     apiToken: common.mediaProviders.TXTVIDEO.apiToken,
    //     supportedMedia: [ASSET_TYPES.VIDEO],
    //   },
    //   [LIBRARY_KEYS.FREESOUND]: {
    //     name: 'Freesound',
    //     icon: freeSoundIcon,
    //     apiUrl: common.mediaProviders.FREESOUND.apiUrl,
    //     apiKey: common.mediaProviders.FREESOUND.apiKey,
    //     audiosApiPath: common.mediaProviders.FREESOUND.audiosApiPath,
    //     supportedMedia: [ASSET_TYPES.AUDIO],
    //   },
    //   [LIBRARY_KEYS.REMOTE]: {
    //     name: 'Library',
    //     icon: audioLibraryIcon,
    //     apiUrl: common.assetsPath,
    //     supportedMedia: [REMOTE_ASSET_TYPES.VIDEOS, REMOTE_ASSET_TYPES.AUDIOS,
    //       REMOTE_ASSET_TYPES.VOICE],
    //   },
    // };
  }
};



export const search = {
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
};

export const CREATIVES_TABS = {
  LOWER_THIRD: 'Lower Thirds',
  CTA_MODES: 'CTA & Modes',
  TEMPLATE_PACK: 'Template Pack',
};

export const LIBRARY_TAB_LABELS = {
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  MUSIC: 'Music',
};

export const tabItems = {
  // [LIBRARY_TABS.TEMPLATES]: {
  //   search,
  //   label: 'Templates',
  //   tooltip: 'Test',
  //   icon: templateIcon,
  //   find: '',
  //   formats: ['.doc', '.videoremix', '.test'],
  // },
  [CREATIVES_TABS.VIDEO]: {
    search,
    label: LIBRARY_TAB_LABELS.VIDEOS,
    tooltip: mediaTooltips.addVideos,
    icon: videoIcon,
    find: 'Find Free Video',
    formats: ['.mp4', '.webm', '.ogv'],
  },
  [CREATIVES_TABS.IMAGE]: {
    search,
    label: LIBRARY_TAB_LABELS.IMAGES,
    tooltip: mediaTooltips.addImages,
    libraryIcon: secondaryImageIcon,
    icon: imageIcon,
    find: 'Find Free Photos',
    formats: ['.jpg', '.svg', '.png', '.gif', '.jpeg', '.webp', '.jfif'],
  },
  [CREATIVES_TABS.AUDIO]: {
    search,
    label: LIBRARY_TAB_LABELS.MUSIC,
    tooltip: mediaTooltips.addAudios,
    icon: musicIcon,
    find: 'Find Free Audio',
    formats: ['.mp3', '.ogg', 'aac'],
  },
  // [LIBRARY_TABS.VOICE]: {
  //   search: {
  //     label: 'Try searching by text you have translated, like',
  //     subLabel: 'Hello  ...',
  //   },
  //   label: 'Voices',
  //   find: '',
  //   formats: ['.mp3'],
  // },
};

export const resourcesWithValidation = ['DROPMOCK', 'TXTVIDEO'];

