/* eslint-disable no-var */
import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import useUserStore from '../../hooks/useUserStore';
import Tabs from './Tabs';
import TabPane from './TabPane';
import BackgroundRemoval from './BackgroundRemoval';
import PhotoEnhancer from './PhotoEnhancer';
import FaceCutOut from './FaceCutOut';
import PhotoColorizer from './PhotoColorizer';
import PhotoAnimer from './PhotoAnimer';
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
// import brush from '../../../public/static/AdvanceImageSvg/samrtBrush.svg';
// import Retouch from './Retouch';
import correction from '../../../public/static/AdvanceImageSvg/smartCorrection.svg';
import { showError } from '../../../lib/services/alertService';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';


const AdvancedImageEditor = observer(({
  handleClose,
  options,
}) => {
  const {
    smartBackgroundRemovalEnabled, smartFaceCutOutEnabled, smartCartoonSelfieEnabled,
    smartEnhancerEnabled, smartColorizerEnabled,
    smartCorrectionEnabled, smartAnimerEnabled,
    smartPassportEnabled,
    //  smartRetouchEnabled,
    cutoutProCreditAvailableBalance,
  } = useUserStore();
  console.log(cutoutProCreditAvailableBalance, 'Here now');
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
          <div style={{ display: 'contents' }}>
            <p>
              User available Credit
              {' '}
              <span style={{ color: 'red' }}>
                {' '}
                {`${cutoutProCreditAvailableBalance}`}
                {' '}
              </span>
            </p>

            {cutoutProCreditAvailableBalance === 0 ? (
              <div>
                <p className="btn btn-link">
                  You have exhausted you credit.
                  {' '}
                  <a> Click here to purchase credit</a>
                </p>
              </div>
            ) : null}

          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="advanced-image-editor-wrapper">
          <Tabs>
            {
              smartBackgroundRemovalEnabled && (
                <TabPane name="Smart BG Removal" icon={RemoveBackgroundSvg} key="1">
                  <BackgroundRemoval
                    imageData={imageMeta}
                    handleClose={handleClose}
                    {...rest}
                  />
                </TabPane>
              )
            }


            {smartFaceCutOutEnabled && (
              <TabPane name="Smart Face Cutout" icon={FaceCutOutSvg} key="2">
                <FaceCutOut
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}

            {smartCartoonSelfieEnabled && (
              <TabPane name="Smart Cartoon Selfie" icon={SelfieSvg} key="3">
                <CartoonSelfie
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}

            {smartEnhancerEnabled && (
              <TabPane name="Smart Enhancer" icon={EnhancerSvg} key="4">
                <PhotoEnhancer
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}

            {smartColorizerEnabled && (
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
            )}


            {smartCorrectionEnabled && (
              <TabPane name="Smart Correction" icon={correction} key="6">
                <PhotoCorrection
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}

            {smartPassportEnabled && (
              <TabPane name="Smart Passport" icon={Passport} key="8">
                <PassportMarker
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}


            {/* {smartAnimerEnabled && (
              <TabPane name="Smart Animer" icon={smartMotion} key="7">
                <PhotoAnimer
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )} */}

            {/* {
              smartRetouchEnabled && (
                <TabPane name="Smart Retouch" icon={brush} key="9">
                  <Retouch
                    imageData={imageMeta}
                    handleClose={handleClose}
                    {...rest}
                  />
                </TabPane>
              )
            } */}

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
