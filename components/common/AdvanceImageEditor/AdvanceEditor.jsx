/* eslint-disable no-var */
import React, { useMemo,lazy,Suspense } from 'react';
import { observer } from 'mobx-react';
import useUserStore from '../../hooks/useUserStore';
import Tabs from './Tabs';
import TabPane from './TabPane';
const BackgroundRemoval = lazy(() => import("./BackgroundRemoval") );
const PhotoEnhancer = lazy(() => import('./PhotoEnhancer'));
const FaceCutOut = lazy(() => import('./FaceCutOut'));
const PhotoColorizer = lazy(() => import('./PhotoColorizer'));
const PhotoCorrection = lazy(() => import('./PhotoCorrection'));
const CartoonSelfie = lazy(() => import('./CartoonSelfie'));
const PassportMarker = lazy(() => import('./PassportMarker'));
import RemoveBackgroundSvg from '../../../public/static/AdvanceImageSvg/removebackgorund.svg';
import FaceCutOutSvg from '../../../public/static/AdvanceImageSvg/faceCutOut.svg';
import SelfieSvg from '../../../public/static/AdvanceImageSvg/selfie.svg';
import EnhancerSvg from '../../../public/static/AdvanceImageSvg/Enhancer.svg';
import ColorizerSvg from '../../../public/static/AdvanceImageSvg/smartColor.svg';
import Passport from '../../../public/static/AdvanceImageSvg/passport.svg';
import correction from '../../../public/static/AdvanceImageSvg/smartCorrection.svg';
import smartMotion from '../../../public/static/AdvanceImageSvg/smartMotion.svg';
const PhotoAnimer = lazy(() => import( './PhotoAnimer'));
// import brush from '../../../public/static/AdvanceImageSvg/samrtBrush.svg';
// import Retouch from './Retouch';
// import { showError } from '../../../lib/services/alertService';
// import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';
// import { showError } from '../../../lib/services/alertService';


const AdvancedImageEditor = observer(({
  handleClose,
  options,
}) => {
  const {
    smartBackgroundRemovalEnabled, smartFaceCutOutEnabled, smartCartoonSelfieEnabled,
    smartEnhancerEnabled, smartColorizerEnabled,
    smartCorrectionEnabled,
    smartPassportEnabled,
    smartAnimerEnabled,
    cutoutProCreditAvailableBalance,
    //  smartRetouchEnabled,
  } = useUserStore();

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
      <Suspense fallback={<div>Loading...</div>}>
        <div className="heading-container">
          <div style={{ display: 'contents' }}>
            <p>
              User available Credit
              {' '}

              {cutoutProCreditAvailableBalance <= 0 ? (
                <span style={{ color: 'red' }}>
                  0
                </span>
              ) : (
                <span style={{ color: 'red' }}>
                  {' '}
                  {`${cutoutProCreditAvailableBalance}`}
                  {' '}
                </span>
              )}
            </p>

            {cutoutProCreditAvailableBalance <= 0 ? (
              <div>
                <p style={{ color: 'red' }} className=" text-danger ">
                  <a style={{ color: 'red' }} className=" text-danger " target="_blank" href="https://videoremix.io/image-pricing/" rel="noopener noreferrer">
                    You have exhausted your credits. Click here to purchase credits.
                  </a>
                </p>
              </div>
            ) : null}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="advanced-image-editor-wrapper">
          <Tabs initialTab="Smart BG Removal">
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
              <TabPane name="Smart Passport" icon={Passport} key="7">
                <PassportMarker
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}


            {smartAnimerEnabled && (
              <TabPane name="Smart Animer" icon={smartMotion} key="8">
                <PhotoAnimer
                  imageData={imageMeta}
                  handleClose={handleClose}
                  {...rest}
                />
              </TabPane>
            )}

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
        </Suspense>
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
