/* eslint-disable no-var */
import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import Tabs from './Tabs';
import TabPane from './TabPane';
import BackgroundRemoval from './BackgroundRemoval';
import PhotoEnhancer from './PhotoEnhancer';
import FaceCutOut from './FaceCutOut';
import PhotoColorizer from './PhotoColorizer';
import closeIcon from '../../../public/static/svgImages/close.svg';


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

        <div className="mt-3">
          <Tabs>
            <TabPane name="Background Removal" key="1">
              <BackgroundRemoval
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>
            <TabPane name=" Photo Enhancer" key="2">
              <PhotoEnhancer
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>
            <TabPane name="Face Cutout" key="3">
              <FaceCutOut
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>
            <TabPane
              name="Photo Colorizer"
              key="4"
            >
              <PhotoColorizer
                imageData={imageMeta}
                handleClose={handleClose}
                {...rest}
              />
            </TabPane>
            <TabPane name="Photo Animer" key="5">
              Coming Soon
            </TabPane>

            <TabPane name=" Retouch" key="6">
              Coming Soon
            </TabPane>

            <TabPane name=" Photo Correction" key="7">
              Coming Soon
            </TabPane>


            <TabPane name=" Cartoon Selfie" key="8">
              Coming Soon
            </TabPane>

            <TabPane name="Passport Marker" key="9">
              Coming Soon
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
