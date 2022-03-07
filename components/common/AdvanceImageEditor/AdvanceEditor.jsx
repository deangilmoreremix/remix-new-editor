/* eslint-disable no-var */
import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
// import SVGInline from 'react-svg-inline';
import Tabs from './Tabs';
import TabPane from './TabPane';
import BackgroundRemoval from './BackgroundRemoval';
import PhotoEnhancer from './PhotoEnhancer';
import FaceCutOut from './FaceCutOut';
import PhotoColorizer from './PhotoColorizer';
import PhotoAnimer from './PhotoAnimer';
import Retouch from './Retouch';
import PhotoCorrection from './PhotoCorrection';
import CartoonSelfie from './CartoonSelfie';
import PassportMarker from './PassportMarker';
import RemoveBackgroundSvg from '../../../public/static/AdvanceImageSvg/removebackgorund.svg';
import FaceCutOutSvg from '../../../public/static/AdvanceImageSvg/faceCutOut.svg';
import SelfieSvg from '../../../public/static/AdvanceImageSvg/selfie.svg';
import EnhancerSvg from '../../../public/static/AdvanceImageSvg/Enhancer.svg';
import ColorizerSvg from '../../../public/static/AdvanceImageSvg/smartColor.svg';
import smartMotion from '../../../public/static/AdvanceImageSvg/smartMotion.svg';
import Passport from '../../../public/static/AdvanceImageSvg/passport.svg';
import brush from '../../../public/static/AdvanceImageSvg/samrtBrush.svg';
import correction from '../../../public/static/AdvanceImageSvg/smartCorrection.svg';


const AdvancedImageEditor = observer(({
  handleClose,
  options,
}) => {
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);

  if (!imageMeta) {
    return null;
  }

  const onClose = () => {
    handleClose();
  };
  return (
    <>
      <div>
        <div className="heading-container">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
          Close
          </button>
        </div>
        <div className="advanced-image-editor-wrapper">
          <Tabs>
            <TabPane name="Smart BG Removal" icon={RemoveBackgroundSvg} key="1">
              <BackgroundRemoval
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Face Cutout" icon={FaceCutOutSvg} key="2">
              <FaceCutOut
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Carton Selfie" icon={SelfieSvg} key="3">
              <CartoonSelfie
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Enhancer" icon={EnhancerSvg} key="4">
              <PhotoEnhancer
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane
              name="Smart Colorizer"
              icon={ColorizerSvg}
              key="5"
            >
              <PhotoColorizer
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>


            <TabPane name="Smart Correction" icon={correction} key="6">
              <PhotoCorrection
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Animer" icon={smartMotion} key="7">
              <PhotoAnimer
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Passport" icon={Passport} key="8">
              <PassportMarker
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

            <TabPane name="Smart Retouch" icon={brush} key="9">
              <Retouch
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>

          </Tabs>
        </div>
      </div>
    </>
  );
});

AdvancedImageEditor.propTypes = {

};

AdvancedImageEditor.defaultProps = {
  noCrop: false,
};

export default AdvancedImageEditor;
