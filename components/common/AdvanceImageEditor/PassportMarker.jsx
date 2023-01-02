/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable global-require */
/* eslint-disable quotes */
/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { triggerBase64Download } from 'react-base64-downloader';
import Carousel from 'react-simply-carousel';
// import { ColorizeOutlined, ControlPointDuplicateOutlined } from '@material-ui/icons';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import useUserStore from '../../hooks/useUserStore';
import config from '../../../config/config';

import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';


import manOne from '../../../public/static/AdvanceImageSvg/idphotodress/man/1.png';
import manTwo from '../../../public/static/AdvanceImageSvg/idphotodress/man/2.png';
import manThree from '../../../public/static/AdvanceImageSvg/idphotodress/man/3.png';
import manFour from '../../../public/static/AdvanceImageSvg/idphotodress/man/4.png';
import manFive from '../../../public/static/AdvanceImageSvg/idphotodress/man/5.png';
import manSix from '../../../public/static/AdvanceImageSvg/idphotodress/man/6.png';
import manSeven from '../../../public/static/AdvanceImageSvg/idphotodress/man/7.png';
import manEight from '../../../public/static/AdvanceImageSvg/idphotodress/man/8.png';
import manNine from '../../../public/static/AdvanceImageSvg/idphotodress/man/9.png';
import manTen from '../../../public/static/AdvanceImageSvg/idphotodress/man/10.png';
import manEleven from '../../../public/static/AdvanceImageSvg/idphotodress/man/11.png';


import womanOne from '../../../public/static/AdvanceImageSvg/idphotodress/woman/1.png';
import womanTwo from '../../../public/static/AdvanceImageSvg/idphotodress/woman/2.png';
import womanThree from '../../../public/static/AdvanceImageSvg/idphotodress/woman/3.png';
import womanFour from '../../../public/static/AdvanceImageSvg/idphotodress/woman/4.png';
import womanFive from '../../../public/static/AdvanceImageSvg/idphotodress/woman/5.png';
import womanSix from '../../../public/static/AdvanceImageSvg/idphotodress/woman/6.png';
import womanSeven from '../../../public/static/AdvanceImageSvg/idphotodress/woman/7.png';
import womanEight from '../../../public/static/AdvanceImageSvg/idphotodress/woman/8.png';
import womanNine from '../../../public/static/AdvanceImageSvg/idphotodress/woman/9.png';
import womanTen from '../../../public/static/AdvanceImageSvg/idphotodress/woman/10.png';
import womanEleven from '../../../public/static/AdvanceImageSvg/idphotodress/woman/11.png';


import childOne from '../../../public/static/AdvanceImageSvg/idphotodress/child/1.png';
import childTwo from '../../../public/static/AdvanceImageSvg/idphotodress/child/2.png';
// import childThree from '../../../public/static/AdvanceImageSvg/idphotodress/child/3.png';
import childFour from '../../../public/static/AdvanceImageSvg/idphotodress/child/4.png';
import childFive from '../../../public/static/AdvanceImageSvg/idphotodress/child/5.png';
import childSix from '../../../public/static/AdvanceImageSvg/idphotodress/child/6.png';
import childSeven from '../../../public/static/AdvanceImageSvg/idphotodress/child/7.png';
import childEight from '../../../public/static/AdvanceImageSvg/idphotodress/child/8.png';
import childNine from '../../../public/static/AdvanceImageSvg/idphotodress/child/9.png';
import childTen from '../../../public/static/AdvanceImageSvg/idphotodress/child/10.png';
import childEleven from '../../../public/static/AdvanceImageSvg/idphotodress/child/11.png';
import childTwelve from '../../../public/static/AdvanceImageSvg/idphotodress/child/12.png';
import PercentageProgressBar from '../../media/PercentageProgressBar';


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
  const [printLayoutImage, setPrintLayoutImage] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [manActiveSlideIndex, setManActiveSlideIndex] = useState(0);
  const [womanActiveSlideIndex, setWomanActiveSlideIndex] = useState(0);
  const [childActiveSlideIndex, setChildActiveSlideIndex] = useState(0);
  const [color, setColor] = useState('FFFFFF');
  const [dress, setDress] = useState('');
  const [isError, setError] = useState(null);


  const { source } = useMemo(() => imageData, [imageData]);


  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };

  useEffect(() => quantify(), []);

  const convertImgUrlToBase64 = (blob) => new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const processImage = async () => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
    const base64Response = await fetch(source);
    const blob = await base64Response.blob();

    const result = await convertImgUrlToBase64(blob);
    const newResult = result.replace(/^data:image\/(jpeg|jpg|png);base64,/, "");

    const data = {
      base64: newResult,
      bgColor: color,
      dpi: 300,
      mmHeight: 35,
      mmWidth: 25,
      printBgColor: color,
      printMmHeight: 210,
      printMmWidth: 150,
      dress,
    };

    fetch(`https://www.cutout.pro/api/v1/idphoto/printLayout`, {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
      body: JSON.stringify(data),
    })
      .then((resp) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        resp.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        if (resp.data === null) {
          setNewImage(null);
          setError('Processing failed');
        } else {
          setNewImage(resp.data.idPhotoImage);
          setPrintLayoutImage(resp.data.printLayoutImage);
          // talk to backend to reduce the use cutopro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const convertToBlob = async (val) => {
    const base64Response = await fetch(val);
    const blob = await base64Response.blob();
    const result = await convertImgUrlToBase64(blob);
    return result;
  };

  const changeBackgroundColor = async (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;

    const base64Response = await fetch(source);
    const blob = await base64Response.blob();

    const result = await convertImgUrlToBase64(blob);
    const newResult = result.replace(/^data:image\/(jpeg|jpg|png);base64,/, "");

    const data = {
      base64: newResult,
      bgColor: val,
      dpi: 300,
      mmHeight: 35,
      mmWidth: 25,
      printBgColor: val,
      printMmHeight: 210,
      printMmWidth: 150,
      dress,
    };
    fetch(`https://www.cutout.pro/api/v1/idphoto/printLayout`, {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
      body: JSON.stringify(data),
    })
      .then((resp) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        resp.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        if (resp.data === null) {
          setNewImage(null);
          setError('Processing failed');
        } else {
          setColor(val);
          setNewImage(resp.data.idPhotoImage);
          setPrintLayoutImage(resp.data.printLayoutImage);
          // talk to backend to reduce the use cutopro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const changeDressPhotoImage = async (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
    const base64Response = await fetch(source);
    const blob = await base64Response.blob();

    const result = await convertImgUrlToBase64(blob);
    const newResult = result.replace(/^data:image\/(jpeg|jpg|png);base64,/, "");

    const data = {
      base64: newResult,
      bgColor: color,
      dpi: 300,
      mmHeight: 35,
      mmWidth: 25,
      printBgColor: color,
      printMmHeight: 210,
      printMmWidth: 150,
      dress: val,
    };
    // console.log(data);
    fetch(`https://www.cutout.pro/api/v1/idphoto/printLayout`, {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
      body: JSON.stringify(data),
    })
      .then((resp) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        resp.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        // setNewImage(resp.data.idPhotoImage);
        // setPrintLayoutImage(resp.data.printLayoutImage);
        if (resp.data === null) {
          setNewImage(null);
          setError('Processing failed');
        } else {
          setDress(val);
          setNewImage(resp.data.idPhotoImage);
          setPrintLayoutImage(resp.data.printLayoutImage);
          // talk to backend to reduce the use cutopro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const onLoadImage = useCallback(async (image) => {
    const result = await convertToBlob(image);
    if (!newImage) {
      return;
    }

    let media;
    let hasError;

    try {
      setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: result, isCrop: true });
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

  const downloadPassport = async () => {
    const base64Response = await fetch(newImage);
    const blob = await base64Response.blob();
    const result = await convertImgUrlToBase64(blob);
    triggerBase64Download(result, 'my_download');
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
                    {/* <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                      Process Passport Marker
                    </button> */}
                    {cutoutProCreditAvailableBalance <= 0
                      ? (
                        null
                      )
                      : (
                        <button onClick={() => processImage()} className="btn  btn-outline-danger  btn-sm">
                          Process Passport Maker
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image </p>

                <div className=" ">
                  {isLoading ? <div className="progressState">
                     <PercentageProgressBar/>
                    </div>: (
                    <div className=" flex justify-content-center">
                      {isProcessImage
                        ? (
                          <>

                            {newImage === null ? (
                              <>
                                <div>
                                  <p>Unable to recognize face, please change a photo</p>
                                  <img
                                    className="editor-image"
                                    src={transparent}
                                  />
                                </div>
                              </>
                            ) : (
                              <img
                                className="editor-image"
                                src={newImage}
                              />

                            )}

                          </>
                        )
                        : <img className="editor-image" src={transparent} />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="download-container">
            <div>
              <p className="">Passport Property</p>

              {cutoutProCreditAvailableBalance <= 0
                ? (
                  null
                )
                : (
                  <>
                    <div>
                      <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
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
                        <button onClick={() => changeBackgroundColor('FFFFFF')} className="color-btn" style={{ backgroundColor: '#FFFFFF' }} />
                        <button onClick={() => changeBackgroundColor('FEACAD')} className="color-btn" style={{ backgroundColor: '#FEACAD' }} />
                        <button onClick={() => changeBackgroundColor('FFD6A5')} className="color-btn" style={{ backgroundColor: '#FFD6A5' }} />
                        <button onClick={() => changeBackgroundColor('A0C5FE')} className="color-btn" style={{ backgroundColor: '#A0C5FE' }} />
                        <button onClick={() => changeBackgroundColor('BCB1FF')} className="color-btn" style={{ backgroundColor: '#BCB1FF' }} />
                        <button onClick={() => changeBackgroundColor('C2C5AA')} className="color-btn" style={{ backgroundColor: '#C2C5AA' }} />
                        <button onClick={() => changeBackgroundColor('F1FBEF')} className="color-btn" style={{ backgroundColor: '#F1FBEF' }} />
                        <button onClick={() => changeBackgroundColor('F1FBEF')} className="color-btn" style={{ backgroundColor: '#F1FBEF' }} />
                        <button onClick={() => changeBackgroundColor('D8D9D8')} className="color-btn" style={{ backgroundColor: '#D8D9D8' }} />
                        <button onClick={() => changeBackgroundColor('BEE1E6')} className="color-btn" style={{ backgroundColor: '#BEE1E6' }} />
                        <button onClick={() => changeBackgroundColor('97F5E1')} className="color-btn" style={{ backgroundColor: '#97F5E1' }} />
                        <button onClick={() => changeBackgroundColor('EB5054')} className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                        <button onClick={() => changeBackgroundColor('E8C1CA')} className="color-btn" style={{ backgroundColor: '#E8C1CA' }} />
                        <button onClick={() => changeBackgroundColor('CFDFC2')} className="color-btn" style={{ backgroundColor: '#CFDFC2' }} />
                        <button onClick={() => changeBackgroundColor('E82055')} className="color-btn" style={{ backgroundColor: '#E82055' }} />
                        <button onClick={() => changeBackgroundColor('23ef56')} className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                        <button onClick={() => changeBackgroundColor('ffed45')} className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                      </Carousel>
                    </div>
                    <div className="mt-1">
                      <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Dress</p>

                      <div>
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
                          activeSlideIndex={manActiveSlideIndex}
                          onRequestChange={setManActiveSlideIndex}
                        >

                          <div role="button" onClick={() => changeDressPhotoImage('man1')} className="imgS border-sel cartoon-container">
                            <img src={manOne} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('man2')} className="imgS border-sel cartoon-container">
                            <img src={manTwo} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('man3')} className="imgS border-sel cartoon-container">
                            <img src={manThree} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('man4')} className="imgS border-sel cartoon-container">
                            <img src={manFour} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('man5')} className="imgS border-sel cartoon-container">
                            <img src={manFive} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('man6')} className="imgS border-sel cartoon-container">
                            <img src={manSix} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('man7')} className="imgS border-sel cartoon-container">
                            <img src={manSeven} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('man8')} className="imgS border-sel cartoon-container">
                            <img src={manEight} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('man9')} className="imgS border-sel cartoon-container">
                            <img src={manNine} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('man10')} className="imgS border-sel cartoon-container">
                            <img src={manTen} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('man11')} className="imgS border-sel cartoon-container">
                            <img src={manEleven} className="carton-avatar" alt="" />
                          </div>


                        </Carousel>
                        <hr />
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
                          activeSlideIndex={womanActiveSlideIndex}
                          onRequestChange={setWomanActiveSlideIndex}
                        >

                          <div role="button" onClick={() => changeDressPhotoImage('woman1')} className="imgS border-sel cartoon-container">
                            <img src={womanOne} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('woman2')} className="imgS border-sel cartoon-container">
                            <img src={womanTwo} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('woman3')} className="imgS border-sel cartoon-container">
                            <img src={womanThree} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('woman4')} className="imgS border-sel cartoon-container">
                            <img src={womanFour} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('woman5')} className="imgS border-sel cartoon-container">
                            <img src={womanFive} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('woman6')} className="imgS border-sel cartoon-container">
                            <img src={womanSix} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('woman7')} className="imgS border-sel cartoon-container">
                            <img src={womanSeven} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('woman8')} className="imgS border-sel cartoon-container">
                            <img src={womanEight} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('woman9')} className="imgS border-sel cartoon-container">
                            <img src={womanNine} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('woman10')} className="imgS border-sel cartoon-container">
                            <img src={womanTen} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('woman11')} className="imgS border-sel cartoon-container">
                            <img src={womanEleven} className="carton-avatar" alt="" />
                          </div>


                        </Carousel>
                        <hr />
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
                          activeSlideIndex={childActiveSlideIndex}
                          onRequestChange={setChildActiveSlideIndex}
                        >

                          <div role="button" onClick={() => changeDressPhotoImage('child1')} className="imgS border-sel cartoon-container">
                            <img src={childOne} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('child2')} className="imgS border-sel cartoon-container">
                            <img src={childTwo} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('child12')} className="imgS border-sel cartoon-container">
                            <img src={childTwelve} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('child4')} className="imgS border-sel cartoon-container">
                            <img src={childFour} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('child5')} className="imgS border-sel cartoon-container">
                            <img src={childFive} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('child6')} className="imgS border-sel cartoon-container">
                            <img src={childSix} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('child7')} className="imgS border-sel cartoon-container">
                            <img src={childSeven} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('child8')} className="imgS border-sel cartoon-container">
                            <img src={childEight} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('child9')} className="imgS border-sel cartoon-container">
                            <img src={childNine} className="carton-avatar" alt="" />
                          </div>
                          <div role="button" onClick={() => changeDressPhotoImage('child10')} className="imgS border-sel cartoon-container">
                            <img src={childTen} className="carton-avatar" alt="" />
                          </div>

                          <div role="button" onClick={() => changeDressPhotoImage('child11')} className="imgS border-sel cartoon-container">
                            <img src={childEleven} className="carton-avatar" alt="" />
                          </div>


                        </Carousel>


                      </div>
                    </div>

                  </>

                )}


            </div>

            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => downloadPassport()} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Download Image
                </button>
              )}
            {cutoutProCreditAvailableBalance <= 0
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
