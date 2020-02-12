import React from 'react';
import { Container } from 'react-bootstrap';
import PropTypes from '../../../lib/PropTypes';

const Toolbar = ({ items }) => {
  const [activeTab, setActiveTab] = React.useState(items[0].key);

  return (
    <Container className="toolbar-container">
      Toolbar is here!
      {items && items.length && items.map(item => (
        <div className="toolbar-item" key={item.key}>
          {item.content}
        </div>
      ))}
    </Container>
  );
};

Toolbar.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    action: PropTypes.func,
  })).isRequired,
};

export default Toolbar;
