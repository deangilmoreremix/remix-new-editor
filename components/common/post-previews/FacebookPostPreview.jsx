import React from 'react';

import PropTypes from '../../../lib/PropTypes';

const FacebookPostPreview = (props) => {
  const {
    user,
    post: { title, thumbnail, description, link },
  } = props;
  const { name, userpic } = user || {};

  return (
    <div className="postPreview">
      <div className="post-wrapper">
        <div className="post-header">
          <div className="user-image">
            <img src={userpic} alt="user avatar" style={{ width: '100px' }} />
          </div>
          <div className="top-header">
            <span className="user">{name}</span>
            <span className="shared"> shared a </span>
            <a href="#" className="link">link</a>
          </div>
          <div className="time">
            Just now · vidcloud.io
            <i className="fa fa-globe" aria-hidden="true" />
            <i className="fa fa-caret-down" aria-hidden="true" />
          </div>
        </div>
        <div className="post-body">
          <div className="post-image">
            <img src={thumbnail} alt="watermark" />
          </div>

          <div className="post-description">
            <div className="post-description-wrapper">
              <div className="post-name">{title}</div>
              <div className="post-caption">{description}</div>
              <div className="post-link">{link}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// TODO: `userpic` to defaultProps to handle users without avatar

FacebookPostPreview.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    userpic: PropTypes.string,
  }),
  post: PropTypes.shape({
    title: PropTypes.string.isRequired,
    thumbnail: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
  }),
};

export default FacebookPostPreview;
