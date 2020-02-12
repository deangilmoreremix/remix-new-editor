import * as React from 'react';
import { Container } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const ElementsPanel = ({ items }) => (
  <Container className="elements-panel-container">
    <div className="elements-panel-inner-row">
      {items.map(({ label, icon, action, visible, disabled }) => {
        if (!visible) return null;

        return (
          <button
            className="elements-panel-button"
            disabled={disabled}
            key={label}
            onClick={action}
            type="button"
          >
            <SVGInline
              className="elements-panel-icon"
              classSuffix="-inline"
              svg={icon}
              cleanup={['title']}
            />
            <span className="elements-panel-label">{label}</span>
          </button>
        );
      })}
    </div>
  </Container>
);

ElementsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    icon: PropTypes.string,
    action: PropTypes.func,
    visible: PropTypes.boolean,
    disabled: PropTypes.boolean,
  })).isRequired,
};

export default ElementsPanel;
