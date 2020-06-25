import { set, observable, action } from 'mobx';

import { IMAGE_CROPPER_MODAL, MODAL_CONFIG, TUI_IMAGE_EDITOR_MODAL } from '../../lib/constants/modals';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import { showError } from '../../lib/services/alertService';
import { checkImageResolution } from '../../lib/utils/cropHelper';
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
      set(options, {});
    }
  };

  const updateHeader = (modalId, header) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].header = header || originalModal.header;
    }
  };

  const updateClassName = (modalId, className) => {
    if (modalId) {
      const mutatedModalIndex = modals.findIndex(modal => modal.id === modalId);
      const originalModal = MODAL_CONFIG.find(modal => modal.id === modalId);

      modals[mutatedModalIndex].className = className || originalModal.className;
    }
  };

  const openCropper = async (src, onImageCropped, resolution, updateField) => {
    if (!src || !onImageCropped) {
      return;
    }
    const imageMeta = new Image();
    imageMeta.src = src;
    const metadata = await new MediaTypeDetector()
      .getMetadata(src);
    if (!metadata.contentType.includes('image')) {
      return showError('Image not found');
    }
    checkImageResolution({
      imageMeta,
      onFileUploaded: openModal(IMAGE_CROPPER_MODAL,
        {
          imageMeta: metadata,
          onImageCropped,
          recommendedResolution: resolution || CROP_RECOMMENDED_RESOLUTION,
          src,
          updateField,
        }),
    });
  };

  const openImageEditor = async (src, onImageCropped, updateField) => {
    if (!src) {
      return;
    }
    const imageMeta = new Image();
    imageMeta.src = src;
    const metadata = await new MediaTypeDetector()
      .getMetadata(src);
    if (!metadata.contentType.includes('image')) {
      return showError('Image not found');
    }
    openModal(TUI_IMAGE_EDITOR_MODAL,
      {
        imageMeta: metadata,
        recommendedResolution: CROP_RECOMMENDED_RESOLUTION,
        src,
        updateField,
        onImageCropped,
      });
  };

  const finishImageEditing = async (imageSrc, onImageCropped) => {
    closeModal(TUI_IMAGE_EDITOR_MODAL);
    await openCropper(imageSrc, (croppedImage) => {
      onImageCropped(croppedImage);
      closeModal(IMAGE_CROPPER_MODAL);
    });
  };


  return {
    modalIds,
    modals,
    openModal: action(openModal),
    closeModal: action(closeModal),
    updateHeader: action(updateHeader),
    updateClassName: action(updateClassName),
    openCropper,
    options,
    openImageEditor,
    finishImageEditing,
  };
};
