import * as React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import useProjectStore from '../../hooks/useProjectStore';

const ProducePanel = observer(({ items }) => {
  const { modified } = useProjectStore();
  console.log(modified);

  return (
    <div className="produce-block produce-panel">
      {items.map((
        { label, action, icon, alwaysOnDisplay },
      ) => {
        if (modified && alwaysOnDisplay) {
          return (
            <button
              type="button"
              key={label}
              onClick={action}
              className="produce-panel__button"
            >
              <SVGInline
                className="produce-panel__icon"
                svg={icon}
                cleanup={['title']}
              />
              {label}
            </button>
          );
        }

        if (!modified) {
          return (
            <button
              type="button"
              key={label}
              onClick={action}
              className="produce-panel__button"
            >
              <SVGInline
                className="produce-panel__icon"
                svg={icon}
                cleanup={['title']}
              />
              {label}
            </button>
          );
        }

        return null;
      })}
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
