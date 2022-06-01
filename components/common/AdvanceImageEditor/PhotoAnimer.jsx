/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { saveAs } from 'file-saver';
import { triggerBase64Download } from 'react-base64-downloader';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import useUserStore from '../../hooks/useUserStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';


const PhotoEnhancer = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  // const refEditor = useRef();
  const { uploadMedia, storeAsset } = useMediaStore();
  const {
    secondaryWindowType: activeTab,
  } = useUIStore();
  const userStore = useUserStore();
  const {
    updateUserCreditUseAndGetUserCreditBalance,
    userCutOutProBalance,
    cutoutProCreditUserUsed,
    cutoutProCreditAvailableBalance,
  } = userStore;

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const { source } = useMemo(() => imageData, [imageData]);
  const [isError, setError] = useState(null);


  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };
  useEffect(() => quantify(), []);

  const onLoadImage = useCallback(async (image) => {
    // const base64Response = await fetch(`data:image/jpeg;base64,${image}`);
    // const blob = await base64Response.blob();
    if (!newImage) {
      return;
    }
    let media;
    let hasError;
    try {
      setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: image, isCrop: true });
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

  const processAnimer = async (val) => {
    await fetch(`https://www.cutout.pro/api/v1/faceDriven/getTaskInfo?taskId=${val}`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
    }).then((data) =>
      // eslint-disable-next-line implicit-arrow-linebreak
      data.json(),
    ).then(resp => {
      setIsLoading(false);
      setIsProcessImage(true);
      console.log(resp);
      if (resp.data.status === 1) {
        setIsLoading(false);
        setIsProcessImage(true);
        setNewImage(resp.data.resultUrl);
      } else if (resp.data.status === 0) {
        setIsLoading(true);
        setTimeout(getTaskInfo, 5000, resp);
      } else if (resp.data.status === 2) {
        console.log(resp, 'At 2');
        // todo: set the UI to show the process is failed
      }
    })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const getTaskInfo = async (resp) => {
    setIsLoading(true);
    processAnimer(resp.data.taskId);
  };


  const processImage = async (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 10;
    await fetch(`https://www.cutout.pro/api/v1/faceDriven/submitTaskByUrl?imageUrl=${source}&templateId=${val}`, {
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
        if (resp.msg === 'Processing failed') {
          setError(resp.msg);
        } else {
          processAnimer(resp.data);
          setError(null);
          // talk to backend to reduce the use cutoutpro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  // const base64 = `data:image/png;base64,${newImage}`;
  const downloadImage = () => {
    saveAs(newImage, 'animer.mp4');
  };


  return (
    <>
      <div className="">

        <div className="">
          {
            isError === 'Processing failed' ? (
              <div>
                <p className="errorText mb-0"> This picture is not supported and no foreground is not recognized </p>
                <p className="errorText">
                  {' '}
                  Please select a picture with a clear distinction between foreground and background.
                  For example a picture of a person, a product, an animal, a car or another object
                  {' '}
                </p>
              </div>
            ) : (
              null
            )
          }
        </div>

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


                    {cutoutProCreditAvailableBalance <= 0
                      ? (
                        null
                      )
                      : (
                        <button onClick={() => processImage(2)} className="btn  btn-outline-danger  btn-sm">
                          Process Photo Animer
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
                          <video
                            className="video-player"
                            src={newImage}
                            controls
                            width="250"
                            muted={false}
                            autoPlay
                            preload="true"
                            loop
                          >
                            <source
                              src={newImage}
                              type="video/mp4"
                            />
                          </video>
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
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Anime</p>
              {cutoutProCreditAvailableBalance <= 0
                ? (
                  null
                )
                : (
                  <div className="flex">

                    <div className=" cartoon-container" tabIndex="0" onClick={() => processImage(2)} role="button" aria-hidden>
                      <video className="carton-avatar" src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer2.mp4" autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '0px' }}>
                        <source src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer2.mp4" type="video/mp4" />
                      </video>
                    </div>

                    <div className=" cartoon-container" tabIndex="0" onClick={() => processImage(1)} role="button" aria-hidden>
                      <video className="carton-avatar" src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer1.mp4" autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '0px' }}>
                        <source src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer1.mp4" type="video/mp4" />
                      </video>
                    </div>

                    <div className=" cartoon-container" tabIndex="0" onClick={() => processImage(3)} role="button" aria-hidden>
                      <video className="carton-avatar" src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer_3.mp4" autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '0px' }}>
                        <source src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer_3.mp4" type="video/mp4" />
                      </video>
                    </div>

                    <div className=" cartoon-container" tabIndex="0" onClick={() => processImage(4)} role="button" aria-hidden>
                      <video className="carton-avatar" src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer4.mp4" autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '0px' }}>
                        <source src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer4.mp4" type="video/mp4" />
                      </video>
                    </div>

                    <div className=" cartoon-container" tabIndex="0" onClick={() => processImage(5)} role="button" aria-hidden>
                      <video className="carton-avatar" src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer5.mp4" autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '0px' }}>
                        <source src="https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer5.mp4" type="video/mp4" />
                      </video>
                    </div>

                  </div>
                )}
            </div>

            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <>
                  <button onClick={() => downloadImage()} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                    Download Anime
                  </button>
                  <button onClick={() => onLoadImage(newImage)} className="btn btn-danger btn-xl mt-5 w-full  w-100">
                    Save to Canvas
                  </button>
                </>
              )}


          </div>


        </div>

      </div>
    </>
  );
});

PhotoEnhancer.propTypes = {
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

PhotoEnhancer.defaultProps = {
  noCrop: false,
};

export default PhotoEnhancer;
