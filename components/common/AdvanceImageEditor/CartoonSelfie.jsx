/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { triggerBase64Download } from 'react-base64-downloader';
import useUserStore from '../../hooks/useUserStore';

import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';


const CartoonSelfie = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const { uploadMedia, storeAsset } = useMediaStore();
  const {
    secondaryWindowType: activeTab,
  } = useUIStore();
  const userStore = useUserStore();
  const { userCutOutProBalance, updateUser, cutoutProCreditUserUsed } = userStore;

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const [symbols, setSymbols] = useState(0);


  const { source } = useMemo(() => imageData, [imageData]);

  const onLoadImage = useCallback(async (image) => {
    const base64Response = await fetch(`data:image/jpeg;base64,${image}`);
    const blob = await base64Response.blob();
    if (!newImage) {
      return;
    }

    let media;
    let hasError;

    try {
      setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: blob, isCrop: true });
      const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
      let fileType = activeTab;
      Object.keys(tabItems).forEach((item) => {
        tabItems[item].formats.forEach((format) => {
          if (format === fileExtension) {
            fileType = item;
          }
        });
      });
      await storeAsset(media, fileType);
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      setIsLoading(false);
      image = media && media.url;
      if (!hasError) {
        onImageEdited(image);
      }
      handleClose();
      endUpload();
    }
  }, [newImage]);

  const quantify = () => {
    userCutOutProBalance()
      .then(value => setSymbols(+value))
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };

  useEffect(() => quantify(), []);


  const processImage = () => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;

    fetch(`https://www.cutout.pro/api/v1/cartoonSelfieByUrl?cartoonType=1&url=${source}`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
    })
      .then((data) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        data.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        setNewImage(resp.data.imageBase64);

        updateUser({ cutOutProCredit: total });
        quantify();
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };


  const ChangeAvatarImage = (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
    fetch(`https://www.cutout.pro/api/v1/cartoonSelfieByUrl?cartoonType=${val}&url=${source}`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
    })
      .then((data) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        data.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        setNewImage(resp.data.imageBase64);

        updateUser({ cutOutProCredit: total });
        quantify();
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const base64 = `data:image/png;base64,${newImage}`;

  return (
    <>
      <div className="">

        <div className="flex advance-editor-modal-content">

          <div className="content-container">

            <div className="flex justify-content-center items-center  ">

              <div className="original-image-container ">
                <p className="text-center font-weight-bold"> Original Image</p>
                <div className=" flex justify-content-center ">
                  <img className="editor-image" src={source} />
                </div>
                <div className="flex justify-content-center ">
                  <div className="mt-5">
                    {/* <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                      Process Cartoon Selfie
                    </button> */}

                    {symbols <= 0
                      ? (
                        null
                      )
                      : (
                        <button onClick={() => processImage()} className="btn  btn-outline-danger  btn-sm">
                          Process Cartoon Selfie
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image</p>

                <div className=" ">
                  {isLoading ? <LibrarySpinner /> : (
                    <div className=" flex justify-content-center">
                      {isProcessImage
                        ? (
                          <img
                            className="editor-image"
                            src={`data:image/png;base64,${newImage}`}
                          />
                        )
                        : <img className="editor-image" src={transparent} />}
                    </div>
                  )}
                </div>


              </div>

            </div>

          </div>


          <div className="download-container">
            <div className="mt-5">
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Avatar Image</p>
              <div className="flex">
                <div role="button" onClick={() => ChangeAvatarImage(6)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonFull1.jpg" className="carton-avatar" alt="" />
                </div>
                <div role="button" onClick={() => ChangeAvatarImage(5)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonAvatar5.png" className="carton-avatar" alt="" />
                </div>
                <div role="button" onClick={() => ChangeAvatarImage(1)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonAvatar1.png" className="carton-avatar" alt="" />
                </div>
                <div role="button" onClick={() => ChangeAvatarImage(2)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonAvatar2.png" className="carton-avatar" alt="" />
                </div>
                <div role="button" onClick={() => ChangeAvatarImage(3)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonAvatar3.png" className="carton-avatar" alt="" />
                </div>
                <div role="button" onClick={() => ChangeAvatarImage(4)} className="imgS border-sel cartoon-container">
                  <img src="https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/cartoon/cartoonAvatar4.png" className="carton-avatar" alt="" />
                </div>
              </div>
            </div>

            {symbols <= 0
              ? (
                null
              )
              : (
                <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Download Image
                </button>
              )}
            {symbols <= 0
              ? (
                null
              )
              : (
                <button onClick={() => onLoadImage(newImage)} className="btn btn-danger btn-xl mt-5 w-full  w-100">
                  Save to Canvas
                </button>
              )}

          </div>


        </div>

      </div>
    </>
  );
});

CartoonSelfie.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  onImageEdited: PropTypes.func.isRequired,
  startUpload: PropTypes.func.isRequired,
  endUpload: PropTypes.func.isRequired,
  noCrop: PropTypes.bool.isRequired,
};

CartoonSelfie.defaultProps = {
  noCrop: false,
};

export default CartoonSelfie;
