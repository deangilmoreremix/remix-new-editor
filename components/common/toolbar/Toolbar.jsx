import React from 'react';
import { Container } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const Toolbar = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[1].label);

  // FIXME: Probably, we should refactor the line below when all the panels are implemented
  //        as not all the panels will have the `items` array to render
  const {
    items: tabContent = [],
    renderer: TabRenderer, func,
  } = items.find(i => i.label === activeTab);
  const onClick = (label) => {
    setActiveTab(label);
  };
  React.useEffect(() => {
    if (func) {
      func();
    }
  }, [activeTab, func]);

  return (
    <Container className="toolbar-container">
      <div className="toolbar-tabs">
        {items.map(({ label, icon }) => (
          <button
            className="toolbar-tab"
            key={label}
            onClick={() => onClick(label)}
            type="button"
          >
            <SVGInline className="toolbar-tab-icon" classSuffix="-inline" svg={icon} cleanup={['title']} />
            <span className="toolbar-tab-title">{label}</span>
          </button>
        ))}
      </div>
      {TabRenderer && <TabRenderer items={tabContent} />}
    </Container>
  );
};

Toolbar.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.func,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })),
    renderer: PropTypes.func,
    func: PropTypes.func,
  })).isRequired,
};

export default Toolbar;
