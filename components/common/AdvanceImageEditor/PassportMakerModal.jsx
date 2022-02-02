import React from 'react';
import { observer } from 'mobx-react';
import PassportProcessMarker from './ProcessPassportMarker';

const PassportMarkerModal = observer(({ handleClose, options }) => (
  <div className="image-editor-modal">
    <PassportProcessMarker
      options={options}
      handleClose={handleClose}
    />

  </div>
));

export default PassportMarkerModal;
