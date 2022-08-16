/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { saveAs } from 'file-saver';
import Carousel from 'react-simply-carousel';
import { Progress } from 'reactstrap';

// import { triggerBase64Download } from 'react-base64-downloader';
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
  onImageEditedValue,
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
  const [active, setActive] = useState();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [progressState, setProgressState] = useState(25);


  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };
  useEffect(() => quantify(), []);
  const onLoadImage = useCallback(async (image) => {
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
        // onImageEditedValue(image);// logic to save to canvas
      }
      handleClose();
      endUpload();
    }
  }, [newImage]);

  const processAnimer = async (val) => {
    const total = cutoutProCreditUserUsed + 10;
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
      console.log(resp);
      if (resp.data.status === 1) {
        setIsLoading(false);
        setIsProcessImage(true);
        setProgressState(100);
        // talk to backend to reduce the use cutoutpro credit
        updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        setNewImage(resp.data.resultUrl);
        setProgressState(25);
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
    const myState = progressState + 25;
    console.log(myState);
    setProgressState(myState);
    processAnimer(resp.data.taskId);
  };


  const processImage = async (val) => {
    setIsLoading(true);
    setActive(val);
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
        if (resp.msg === 'Processing failed') {
          setError(resp.msg);
        } else {
          processAnimer(resp.data);
          setError(null);
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const downloadImage = () => {
    saveAs(newImage, 'animer.mp4');
  };


  const animerList = [
    // {
    //   name: 'Animer1',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer1.mp4',
    //   id: 1,
    // },

    // {
    //   name: 'Animer2',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer2.mp4',
    //   id: 2,
    // },

    // {
    //   name: 'Animer3',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer_3.mp4',
    //   id: 3,
    // },
    // {
    //   name: 'Animer4',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer4.mp4',
    //   id: 4,
    // },
    // {
    //   name: 'Animer5',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/site/en/photoAnimer5.mp4',
    //   id: 5,
    // },


    {
      name: 'Animer0',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/0.mp4',
      id: 0,
    },


    {
      name: 'Animer1',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/1.mp4',
      id: 1,
    },


    {
      name: 'Animer2',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/2.mp4',
      id: 2,
    },

    {
      name: 'Animer3',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/3.mp4',
      id: 3,
    },

    {
      name: 'Animer4',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/4.mp4',
      id: 4,
    },

    {
      name: 'Animer5',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/5.mp4',
      id: 5,
    },

    {
      name: 'Animer6',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/6.mp4',
      id: 6,
    },

    {
      name: 'Animer7',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/7.mp4',
      id: 7,
    },


    {
      name: 'Animer8',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/8.mp4',
      id: 8,
    },


    {
      name: 'Animer9',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/9.mp4',
      id: 9,
    },


    {
      name: 'Animer10',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/10.mp4',
      id: 10,
    },

    {
      name: 'Animer11',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/11.mp4',
      id: 11,
    },

    {
      name: 'Animer12',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/12.mp4',
      id: 12,
    },


    {
      name: 'Animer13',
      src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/13.mp4',
      id: 13,
    },

    // {
    //   name: 'Animer14',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/14.mp4',
    //   id: 14,
    // },

    // {
    //   name: 'Animer15',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/15.mp4',
    //   id: 15,
    // },


    // {
    //   name: 'Animer16',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/16.mp4',
    //   id: 16,
    // },

    // {
    //   name: 'Animer17',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/17.mp4',
    //   id: 17,
    // },

    // {
    //   name: 'Animer18',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/18.mp4',
    //   id: 18,
    // },
    // {
    //   name: 'Animer19',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/19.mp4',
    //   id: 19,
    // },

    // {
    //   name: 'Animer20',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/20.mp4',
    //   id: 20,
    // },


    // {
    //   name: 'Animer21',
    //   src: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/animer/animer/21.mp4',
    //   id: 21,
    // },


  ];


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

                <div className="">
                  {isLoading ? (
                    <div className="progressState">
                      <Progress
                        className=""
                        animated
                        color="danger"
                        value={progressState}
                        style={{
                          height: '40px',
                        }}
                      >
                        {progressState}
                        {' '}
                        %
                      </Progress>


                    </div>

                  ) : (
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
                            preload="none"
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
                    <Carousel
                      containerProps={{
                        style: {
                          width: '100%',
                          display: 'flex',
                          justifyContent: '',
                        },
                      }}
                      forwardBtnProps={{
                        children: '>',
                        style: {
                          border: 'none',
                          height: '20%',
                          justifyContent: 'center',
                          marginTop: '5px',
                          marginRight: '3px',
                          display: 'flex',
                          padding: '3px',
                          background: 'none',
                          color: '#fff',
                          outline: 'none',
                          // alignSelf: 'center',
                        },
                      }}
                      backwardBtnProps={{
                        children: '<',
                        style: {
                          border: 'none',
                          height: '20%',
                          justifyContent: 'center',
                          marginTop: '5px',
                          display: 'flex',
                          padding: '3px',
                          background: 'none',
                          color: '#fff',
                          outline: 'none',
                          // alignSelf: 'center',
                        },
                      }}
                      itemsToShow={10}
                      itemsToScroll={3}
                      activeSlideIndex={activeSlideIndex}
                      onRequestChange={setActiveSlideIndex}
                    >

                      {animerList.map((val) => (
                        <div className={val.id === active ? 'carton-active' : 'cartoon-container'} tabIndex="0" onClick={() => processImage(val.id)} role="button" aria-hidden>
                          <video className="carton-avatar" src={val.src} autoPlay="autoplay" muted="muted" loop="loop" style={{ margin: '5px' }}>
                            <source src={val.src} type="video/mp4" />
                          </video>
                        </div>
                      ))}
                    </Carousel>
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
                    Save to Video Library
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
