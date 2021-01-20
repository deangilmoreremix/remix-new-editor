import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import moment from 'moment';

import PropTypes from '../../../lib/PropTypes';

import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';

const TemplatesPreview = observer((props) => {
  const { item } = props;

  const date = useMemo(() => (
    moment(item.createdAt).format('MM-DD-YYYY')
  ), [item.updatedAt]);

  return (
    <div className="projects-library__item library__item">
      <div className="library__item-image" style={{ backgroundImage: `url(${item.thumbnail || DEFAULT_THUMBNAIL})` }} />
      <div className="projects-item-buttons">
        <button className="projects-item-preview">Preview</button>
        <button className="projects-item-edit">Edit</button>
      </div>
      <div className="library__item-information">
        <span>{item.title}</span>
        <span>{date}</span>
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
