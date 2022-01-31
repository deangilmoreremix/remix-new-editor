/* eslint-disable no-unused-vars */
/* eslint-disable no-var */
import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import closeIcon from '../../../public/static/svgImages/close.svg';


const ProcessPassportMarker = observer(({
  handleClose,
  options,
}) => {
  const onClose = () => {
    handleClose();
  };
  // eslint-disable-next-line implicit-arrow-linebreak
  return (
    <>
      <div className="advance-editor-modal">

        <div className="flex justify-content-between align-items-center align-content-center ">
          <div>
            <p className="text-header">Advance AI Image Feature</p>
          </div>

          <div>

            <SVGInline
              className="icon icon-button"
              svg={closeIcon}
              component="button"
              onClick={onClose}
            />
          </div>

        </div>

      </div>
    </>
  );
});

ProcessPassportMarker.propTypes = {

};

ProcessPassportMarker.defaultProps = {
  noCrop: false,
};

export default ProcessPassportMarker;
