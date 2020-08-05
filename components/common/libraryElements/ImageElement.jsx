import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

const ImageElement = ({ handleSelect, item, className }) => {
  const url = item.data || item.preview || item.url;

  return (
    <div className={classnames('list-item', className)}>
      <div>
        {url && <img src={url} alt="img" />}
      </div>
      <button
        className="animation-preview__add"
        onClick={() => handleSelect(item)}
      />
    </div>
  );
};

ImageElement.propTypes = {
  item: PropTypes.shape({
    data: PropTypes.string,
    preview: PropTypes.string,
    url: PropTypes.string,
  }),
  handleSelect: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default ImageElement;
