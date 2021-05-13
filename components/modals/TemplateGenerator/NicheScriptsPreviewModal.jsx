import React, { useEffect, useState, memo } from 'react';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../../lib/PropTypes';

import addIcon from '../../../public/static/svgImages/modals/niche-preview-icon.svg';
import { getNicheTextData } from '../../../lib/utils/popcorn-helper';

const NicheScriptsPreviewModal = memo(({ options }) => {
  const { item, onSelectItem } = options;

  const [textInfo, setTextInfo] = useState('');

  useEffect(() => {
    if (item) {
      const itemsTextData = getNicheTextData(item);
      if (itemsTextData && itemsTextData !== '') {
        setTextInfo(itemsTextData);
      }
    }
  }, [item]);

  return (
    <div className="niche-scripts-preview-modal__box">
      <div className="niche-scripts-preview-modal__title">
        <SVGInline
          className="niche-scripts-preview-modal__icon"
          svg={addIcon}
        />
      </div>
      <div className="niche-scripts-preview-modal__content">
        <span>{textInfo}</span>
      </div>
      <button className="niche-scripts-preview-modal__button" onClick={onSelectItem}>
        Select
      </button>
    </div>
  );
});

NicheScriptsPreviewModal.propTypes = {
  options: PropTypes.shape({
    item: PropTypes.shape({}).isRequired,
    onSelectItem: PropTypes.func.isRequired,
  }).isRequired,
};

export default NicheScriptsPreviewModal;
