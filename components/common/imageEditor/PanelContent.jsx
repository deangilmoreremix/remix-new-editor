import React from 'react';
import Header from "./Header";
import PropTypes from '../../../lib/PropTypes';
import { panelItems } from '../../../lib/constants/imageEditor/editor-panel';

import TemplatesContent from './contents/TemplatesContent';

const contents = {
  TEMPLATES: <TemplatesContent />,
}

const PanelContent = ({activeItem}) => {
  return (
    <div className="editor-panel-content">
      <Header placeholder={activeItem} />
      {
        contents[activeItem]
      }
    </div>
  );
};

PanelContent.propTypes = {
  activeItem: PropTypes.string.isRequired
};

export default PanelContent;