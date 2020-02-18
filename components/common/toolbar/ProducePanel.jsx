import React from 'react';
import { Container } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

// todo add styles
const ProducePanel = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[0].label);

  const activeTabItem = items.find(i => i.label === activeTab);
  const Panel = activeTabItem.renderer;

  return (
    <Container>
      <div>
        {items.map(({ label }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            type="button"
          >
            <span className="toolbar-tab-title">{label}</span>
          </button>
        ))}
      </div>
      <Panel />
    </Container>
  );
};

ProducePanel.propTypes = {
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

export default ProducePanel;