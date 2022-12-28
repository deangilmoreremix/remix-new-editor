import React from 'react';
import { observer } from 'mobx-react';
import PinturaImageEditor from '../common/PinturaImageEditor';

const PinturaImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, ...rest } = React.useMemo(
    () => options, [options]);
  return (
  <div className="image-editor-modal">
    <PinturaImageEditor
      options={options}
      handleClose={handleClose}
      {...rest}
    />
  </div>
)});

export default PinturaImageEditorModal;
