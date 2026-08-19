import { SOCIAL_PUBLISH_MODAL } from '../../lib/constants/modals';

// Opens the SocialPublishModal from anywhere in the app (modern ModalContainer
// path mounted by src/mountModalSystem.jsx). Safe no-op if the modal system
// isn't mounted yet.
//
//   openSocialPublish({ mediaUrl, mediaType: 'image' | 'video', title, tags });
export function openSocialPublish(options = {}) {
  if (typeof window === 'undefined' || typeof window.openModal !== 'function') {
    console.warn('[openSocialPublish] modal system not ready; cannot open social publisher.');
    return;
  }
  window.openModal(SOCIAL_PUBLISH_MODAL, options);
}

export { SOCIAL_PUBLISH_MODAL };
