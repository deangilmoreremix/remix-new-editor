import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';


const ProjectPreview = observer((props) => {
  const { item } = props;
  return (
    <div
      style={{ backgroundImage: `url(${item.thumbnail || DEFAULT_THUMBNAIL})` }}
      className="library__item"
    />
  );
});

ProjectPreview.propTypes = {
  item: PropTypes.shape({
    thumbnail: PropTypes.string,
  }).isRequired,
};

export default ProjectPreview;
