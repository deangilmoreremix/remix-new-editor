import React from 'react';
import Header from './Header';
import PropTypes from '../../../lib/PropTypes';

import TemplatesContent from './contents/TemplatesContent';

const contents = {
  TEMPLATES: <TemplatesContent />,
};

const PanelContent = ({ activeItem }) => (
  <div className="editor-panel-content">
    <Header />
    {
        contents[activeItem]
      }
  </div>
);

PanelContent.propTypes = {
  activeItem: PropTypes.string.isRequired,
};

export default PanelContent;
