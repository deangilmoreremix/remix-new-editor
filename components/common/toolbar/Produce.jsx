import React from 'react';
import { Container } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

// todo add styles
const Produce = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[0].label);

  const activeTabItem = items.find(i => i.label === activeTab);
  const { renderer: Panel, items: panelItems = [] } = activeTabItem;

  return (
    <div className="produce">
      <div className="produce__tabs">
        {items.map(({ label }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            type="button"
            className="produce__tab"
          >
            <span className="toolbar__tab-title">{label}</span>
          </button>
        ))}
      </div>
      <Panel items={panelItems} />
    </div>
  );
};

Produce.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.oneOfType([
      PropTypes.shape({}),
      PropTypes.func,
    ]).isRequired,
  })).isRequired,
};

export default Produce;
