import React from 'react';
import { Container } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const Toolbar = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[1].key);

  let tabContent = [];
  const activeTabItem = items.find(i => i.key === activeTab);
  if (activeTabItem) tabContent = activeTabItem.items;
  const TabRenderer = activeTabItem.renderer;

  return (
    <Container className="toolbar-container">
      <div className="toolbar-tabs">
        {items.map(({ key, label, icon }) => (
          <button
            className="toolbar-tab"
            key={key}
            onClick={() => setActiveTab(key)}
            type="button"
          >
            <SVGInline className="toolbar-tab-icon" classSuffix="" svg={icon} cleanup={['title']} />
            <span className="toolbar-tab-title">{label}</span>
          </button>
        ))}
      </div>
      <TabRenderer items={tabContent} />
    </Container>
  );
};

Toolbar.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string,
      icon: PropTypes.string,
    })),
    renderer: PropTypes.func.isRequired,
  })).isRequired,
};

export default Toolbar;
