import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import { showInfo } from '../../../lib/services/alertService';

const ProducePanel = observer(({ items, tab, setActiveTab }) => {
  const onCLick = (action, isActive, errorMessage) => {
    if (isActive) {
      action();
    } else {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
  };

  return (
    <div className="produce-block produce-panel">
      {items.map(({ label, action, icon, isActive, errorMessage }) => (
        <button
          type="button"
          key={label}
          onClick={() => onCLick(action, isActive, errorMessage)}
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
      ))}
    </div>
  );
});

ProducePanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    icon: PropTypes.string.isRequired,
  })).isRequired,
  tab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};

export default ProducePanel;
