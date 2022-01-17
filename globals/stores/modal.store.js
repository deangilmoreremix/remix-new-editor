import { set, remove, observable, action } from 'mobx';

import { IMAGE_CROPPER_MODAL, MODAL_CONFIG, PIXO_IMAGE_EDITOR_MODAL, ADVANCE_IMAGE_EDITOR_MODAL } from '../../lib/constants/modals';
import { checkImageResolution } from '../../lib/utils/cropHelper';
import { getImageSize } from '../../lib/utils/imageEditorHelper';
import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';


export default () => {
  const modalIds = observable.set([]);

  const modals = observable(MODAL_CONFIG);

  const options = observable({});

  const openModal = (modalId, modalOptions) => {
    if (modalId) {
      modalIds.add(modalId);
      if (modalOptions) {
        set(options, { ...modalOptions });
      }
    }
  };

  const closeModal = (modalId) => {
    if (modalId) {
      modalIds.delete(modalId);
      const keys = Object.keys(options);
      keys.forEach(key => remove(options, key));
    }
  };

  const updateHeader = (modalId, header) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].header = header || originalModal.header;
    }
  };

  const updateHeaderProps = (modalId, props = {}) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      modals[mutatedModalIndex].header = { ...modals[mutatedModalIndex].header, ...props };
    }
  };

  const updateClassName = (modalId, className) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].className = className || originalModal.className;
    }
  };

  const updateMaxWidth = (modalId, maxWidth) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].maxWidth = maxWidth || originalModal.maxWidth;
    }
  };

  const openCropper = async (scope) => {
    const {
      image,
      onImageCropped,
      recommendedResolution,
      cancelCropper,
      setError,
      saveFile,
      openImageEditor,
    } = scope;
    let imageMeta;
    if (!image.src || !onImageCropped) {
      return;
    }
    // todo check small img
    try {
      imageMeta = await getImageSize(image);
    } catch (e) {
      if (setError) {
        setError(e.message);
      }
      return;
    }
    // for cross origin
    if (saveFile) {
      try {
        image.src = await saveFile(image.src);
      } catch (e) {
        if (setError) {
          setError(e.message);
        }
        return;
      }
    }
    imageMeta.source = image.src;
    checkImageResolution({
      imageMeta,
      recommendedResolution: recommendedResolution || CROP_RECOMMENDED_RESOLUTION,
      cancelCropper,
      openCropper: () => openModal(IMAGE_CROPPER_MODAL,
        {
          ...scope,
          openImageEditor,
          src: image.src,
          imageMeta,
        }),
    });
  };

  const openImageEditor = async (scope) => {
    const { src } = scope;
    if (!src) {
      return;
    }
    const metadata = { source: src };

    openModal(PIXO_IMAGE_EDITOR_MODAL,
      {
        ...scope,
        imageMeta: metadata,
      });
  };


  const openAdvanceImageEditor = async (scope) => {
    const { src } = scope;
    if (!src) {
      return;
    }
    const metadata = { source: src };

    openModal(ADVANCE_IMAGE_EDITOR_MODAL,
      {
        ...scope,
        imageMeta: metadata,
      });
  };


  return {
    modalIds,
    modals,
    openModal: action(openModal),
    closeModal: action(closeModal),
    updateHeader: action(updateHeader),
    updateHeaderProps: action(updateHeaderProps),
    updateClassName: action(updateClassName),
    updateMaxWidth: action(updateMaxWidth),
    openCropper,
    options,
    openImageEditor,
    openAdvanceImageEditor,
  };
};
