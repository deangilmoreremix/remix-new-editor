import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';

const TemplatesPreview = observer((props) => {
  const { item } = props;
  return (
    <div className="library__item">
      <div className="library__item-image" style={{ backgroundImage: `url(${item.thumbnail || DEFAULT_THUMBNAIL})` }} />
      <div className="library__item-information">
        <span>{item.title}</span>
      </div>
    </div>
  );
});

TemplatesPreview.propTypes = {
  item: PropTypes.shape({
    thumbnail: PropTypes.string,
  }).isRequired,
};

export default TemplatesPreview;
