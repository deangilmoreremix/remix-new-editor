import React from 'react';
import { observer } from 'mobx-react';
import AdvancedImageEditor from '../common/AdvanceImageEditor/AdvanceEditor';

const AdvancedImageEditorModal = observer(({ handleClose, options }) => (
  <div>
    <AdvancedImageEditor
      options={options}
      handleClose={handleClose}
    />

  </div>
));

export default AdvancedImageEditorModal;
