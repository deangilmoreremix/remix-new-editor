import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import { showInfo } from '../../../lib/services/alertService';

const ProducePanel = observer(({ items, tab, setActiveTab }) => {
  const onCLick = (action, isActive, errorMessage, url) => {
    if (url && !isActive) {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
    if (isActive) {
      if (!url) {
        action();
      }
    } else {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
  };

  const svgButton = (label, action, isActive, errorMessage, icon, url) => (
    <button
      type="button"
      key={label}
      onClick={() => onCLick(action, isActive, errorMessage, url)}
      className={classnames('produce-panel__button', {
        'produce-panel__button--active': isActive,
      })}
    >
      <SVGInline
        className="produce-panel__icon"
        svg={icon}
        cleanup={['title']}
      />
      {label}
    </button>
  );

  return (
    <div className="produce-block produce-panel">
      {items.map(({ label, action, icon, isActive, errorMessage, url }) => (
        isActive && url ? (
        // eslint-disable-next-line react/jsx-no-target-blank
          <a key={`${label}-href`} href={url} target="_blank">
            {svgButton(label, action, isActive, errorMessage, icon, url)}
          </a>
        )
          : svgButton(label, action, isActive, errorMessage, icon)
      ))}
    </div>
  );
});

ProducePanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    icon: PropTypes.string.isRequired,
    url: PropTypes.string,
  })).isRequired,
  tab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};

export default ProducePanel;
