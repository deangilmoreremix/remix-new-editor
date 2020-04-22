import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import { showInfo } from '../../../lib/services/alertService';

const ProducePanel = observer(({ items, tabs, setActiveTab }) => {
  const { modified, allowedSocials } = useProjectStore();

  const onCLick = (action, alwaysOnDisplay) => {
    if ((modified && alwaysOnDisplay)
      || ((allowedSocials && allowedSocials.length) || alwaysOnDisplay)) {
      action();
    } else {
      showInfo('Please allow Facebook and LinkedIn in our project to continue');
      setActiveTab(tabs[1].label);
    }
  };

  return (
    <div className="produce-block produce-panel">
      {items.map(({ label, action, icon, alwaysOnDisplay }) => (
        <button
          type="button"
          key={label}
          onClick={() => onCLick(action, alwaysOnDisplay)}
          className={classnames('produce-panel__button', {
            'produce-panel__button--active':
              (modified && !alwaysOnDisplay)
              || (allowedSocials && allowedSocials.length === 0 && !alwaysOnDisplay),
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
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
  })).isRequired,
  setActiveTab: PropTypes.func.isRequired,
};

export default ProducePanel;
