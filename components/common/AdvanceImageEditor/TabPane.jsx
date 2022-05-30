/* eslint-disable react/no-unused-prop-types */
import React from 'react';
import PropTypes from 'prop-types';

// eslint-disable-next-line react/destructuring-assignment
// eslint-disable-next-line react/prop-types
const TabPane = (props) => <div className="tab-pane">{props.children}</div>;
TabPane.propTypes = {
  // eslint-disable-next-line react/no-unused-prop-types
  name: PropTypes.string,
};

export default TabPane;
