/* eslint-disable no-var */
import React, { useCallback, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
// import Pagination from '@material-ui/lab/Pagination';
import  {Carousel,  ScrollingCarousel } from '@trendyol-js/react-carousel';
import { triggerBase64Download } from 'react-base64-downloader';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';

const BackgroundRemoval = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  // const refEditor = useRef();
  const { uploadMedia } = useMediaStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const [color, setColor] = useState('');

  const transparent = 'https://user-images.githubusercontent.com/20482760/56193735-a33f2800-6031-11e9-80c7-878dad341315.png';
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

  const processImage = () => {
    setIsLoading(true);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&mattingType=6`, {
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
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const changeBackground = (e) => {
    setColor(e.target.value.substring(1));
    setIsLoading(true);
    console.log(color);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&bgcolor=${color}&mattingType=6`, {
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
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const changeColorBackground = (val) => {
    // setColor(e.target.value.substring(1));
    // setIsLoading(true);
    // &bgcolor=FFFFFF
    // &bgcolor=fffe65
    // console.log(color);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&bgcolor=${val}&mattingType=6`, {
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
                    <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                      Remove Background Image
                    </button>
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
            <div className="mßt-5">
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
              <div className="">
                {/* <input type="color" value="#fffff" />
                <input type="color" value="#e66465" />
                <input type="color" value="#ee465" />e
                <input type="color" value="#d644e5" /> */}
                {/* <button className="color-btn" style={{ backgroundColor: '#ffffff' }} />
                <button className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                <button className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                <button className="color-btn" style={{ backgroundColor: '#ff45ed' }} />
                <button className="color-btn" style={{ backgroundColor: '#234ede' }} />
                <button className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                <input className="input-editor" type="color" value={color} onChange={changeBackground} /> */}
                <Carousel show={8} slide={2} transition={0.5}>
                  <button className="color-btn" style={{ backgroundColor: '#fffff' }} />
                  <button className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                  <button className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                  <button className="color-btn" style={{ backgroundColor: '#ff45ed' }} />
                  <button className="color-btn" style={{ backgroundColor: '#234ede' }} />
                  <button className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                  <button className="color-btn" style={{ backgroundColor: '#ffffff' }} />
                  <button className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                  <button className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                  <button className="color-btn" style={{ backgroundColor: '#ff45ed' }} />
                  <button className="color-btn" style={{ backgroundColor: '#234ede' }} />
                  <button className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                </Carousel>
              </div>
            </div>
            <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
              Download Image
            </button>

            <button onClick={() => onLoadImage(newImage)} className="btn btn-danger btn-xl mt-5 w-full  w-100">
              Save to Canvas
            </button>
          </div>
        </div>

      </div>
    </>
  );
});

BackgroundRemoval.propTypes = {
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

BackgroundRemoval.defaultProps = {
  noCrop: false,
};

export default BackgroundRemoval;
