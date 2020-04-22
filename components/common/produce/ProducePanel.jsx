import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';

const ProducePanel = observer(({ items }) => {
  const { modified, allowedSocials } = useProjectStore();

  const onCLick = (action, alwaysOnDisplay) => {
    if ((modified && alwaysOnDisplay) || ((allowedSocials && allowedSocials.length) || alwaysOnDisplay)) {
      action();
    } else {

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
};

export default ProducePanel;
