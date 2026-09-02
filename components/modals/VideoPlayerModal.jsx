import React from 'react';
import PropTypes from 'prop-types';
import { CardContent, Divider, Icon, IconButton } from '@material-ui/core';

import VideoPlayer from '../media/VideoGallery/VideoPlayer';

const VideoPlayerModal = ({ handleClose, options }) => (
  <div>
    <IconButton aria-label="close" onClick={handleClose} className="close-icon">
      <Icon className="fa fa-times" />
    </IconButton>
    <Divider />
    <CardContent>
      <VideoPlayer url={options.url} />
    </CardContent>
  </div>
);

VideoPlayerModal.propTypes = {
  options: PropTypes.shape({
    url: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }),
  handleClose: PropTypes.func.isRequired,
};

export default VideoPlayerModal;
