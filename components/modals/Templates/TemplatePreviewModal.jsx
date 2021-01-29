import React, { Fragment } from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import VideoPlayer from '../../media/VideoGallery/VideoPlayer';
import useUserStore from '../../hooks/useUserStore';

const TemplatePreviewModal = ({ options }) => {
  const { item, mute } = options;
  const { hasPermissions } = useUserStore();

  return (
    <Fragment>
      {item.preview && (
        <VideoPlayer
          autoPlay
          url={item.preview}
          muted={mute}
          containerClassName="template-preview-modal__container"
          videoClassName="template-preview-modal__video"
        />
      )}
      <div className="template-preview-modal__panel">
        <span
          className={
            classnames('preview-modal__panel-title', {
              'preview-modal__panel-title-white': !hasPermissions,
            })
          }
        >
          {item.title}
        </span>
        <button className="template-preview-modal__panel-button" onClick={() => {}}>Edit</button>
        <button
          className={
            classnames('template-preview-modal__panel-button-share', {
              'template-preview-modal__panel-button-share-white': !hasPermissions,
            })
          }
          onClick={() => {}}
        >
          Share
        </button>
      </div>
    </Fragment>
  );
};

TemplatePreviewModal.propTypes = {
  options: PropTypes.shape({
    item: PropTypes.shape({
      preview: PropTypes.string,
      title: PropTypes.string.isRequired,
    }).isRequired,
    mute: PropTypes.bool,
  }),
};

TemplatePreviewModal.defaultProps = {
  options: {
    mute: false,
  },
};

export default TemplatePreviewModal;
