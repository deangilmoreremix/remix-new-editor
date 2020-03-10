import React from 'react';
import { Container, Button } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

// todo add styles
const PlayButton = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[0].label);
  //todo media
  const media = {};

  const play = () => {
    if (media.paused) {
      media.paused = false;
    } else {
      _medmediaia.paused = true;
    }
  };

  return (
    <Button onClick={play}>play</Button>
  );
};

PlayButton.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.oneOfType([
      PropTypes.shape({}),
      PropTypes.func,
    ]).isRequired,
  })).isRequired,
};

export default PlayButton;
