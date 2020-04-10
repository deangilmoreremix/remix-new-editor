import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';

const SettingsPanel = observer(({ items }) => {
  const { modified } = useProjectStore();

  return (
    <div className="produce-block settings-panel">
      {items.map(({ label, action, icon }) => (
        <button
          type="button"
          key={label}
          onClick={action}
          className="settings-panel__button"
          disabled={modified && label.toLowerCase() !== 'list builder'}
        >
          <SVGInline
            className="settings-panel__icon"
            svg={icon}
            cleanup={['title']}
          />
          {label}
        </button>
      ))}
    </div>
  );
});

SettingsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    icon: PropTypes.string.isRequired,
  })).isRequired,
};

export default SettingsPanel;
