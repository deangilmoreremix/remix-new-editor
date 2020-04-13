import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';

const ProducePanel = observer(({ items }) => {
  const { modified } = useProjectStore();
  const alwaysActive = 'list builder';

  return (
    <div className="produce-block produce-panel">
      {items.map(({ label, action, icon }) => (
        <button
          type="button"
          key={label}
          onClick={action}
          className="produce-panel__button"
          disabled={modified && label.toLowerCase() !== alwaysActive}
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
