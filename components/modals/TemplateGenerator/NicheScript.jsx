import React from 'react';
import SVGInline from 'react-svg-inline';

import classnames from 'classnames';
import useModalStore from '../../hooks/useModalStore';

import PropTypes from '../../../lib/PropTypes';
import icon from '../../../public/static/svgImages/template-generator/niche-script.svg';
import { NICHE_SCRIPTS_PREVIEW_MODAL } from '../../../lib/constants/modals';
import selectIcon from '../../../public/static/images/media/icon-select.svg';

const NicheScript = React.memo((props) => {
  const { item, onClick, activeItem, allowedPreview } = props;
  const { openModal, closeModal } = useModalStore();

  const openPreview = (e) => {
    e.stopPropagation();
    openModal(NICHE_SCRIPTS_PREVIEW_MODAL, { item: JSON.parse(item.project.data), onSelectItem });
  };

  const isActive = React.useMemo(() => activeItem && activeItem._id === item._id, [activeItem]);

  const onSelectItem = () => {
    onClick(!isActive && item);
    closeModal(NICHE_SCRIPTS_PREVIEW_MODAL);
  };

  return (
    <div
      className={classnames('niche-script', { active: isActive })}
      onClick={onSelectItem}
      onKeyDown={onSelectItem}
      role="button"
      tabIndex={0}
    >
      { isActive && (
        <SVGInline
          className="preview__select"
          svg={selectIcon}
        />
      ) }
      <div className="niche-script__title">
        <SVGInline svg={icon} cleanup={['arrow']} className="niche-script__title-icon" />
        <span className="niche-script__title">{item.title}</span>
      </div>
      { allowedPreview
      && <button className="niche-script__button" onClick={openPreview}>Preview</button> }
    </div>
  );
});

NicheScript.propTypes = {
  item: PropTypes.shape({
    title: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    project: PropTypes.shape({
      data: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  allowedPreview: PropTypes.bool,
  activeItem: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
};

export default NicheScript;
