/* eslint-disable func-names */
/* eslint-disable array-callback-return */
/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { observer } from 'mobx-react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
// import Pagination from '@material-ui/lab/Pagination';
import { triggerBase64Download } from 'react-base64-downloader';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';
import { tabItems } from '../../../lib/constants/library';



const PhotoEnhancer = observer(({
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
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [newImage, setNewImage] = useState('');
  const [draw, setDraw] = useState(false);
  const [imgDimension, setImgDimension] = useState({
    width: 0,
    height: 0,
  });


  const canvasRef = useRef(null);

  const startDraw = (e) => {
    setDraw(true);
    maskImage(e);
  };

  const endDraw = async () => {
    // console.log('endDraw');
    const canvas = canvasRef.current;
    const path = await canvas.exportPaths();
    // console.log(path);

    const points = path.map(resp => resp.paths);
    // console.log(points.flat());
    let result = points.flat();
    result = result.map(point => ({
      x: point.x,
      y: point.y,
      width: 100,
      height: 100,
    }));
    // console.log(result);
    return result;
  };

  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    await canvas.clearCanvas();
  };


  const maskImage = (e) => {
    e.persist();
    // if (!draw) return;
    const canvas = canvasRef.current;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.lineWidth = 20;
    context.lineCap = 'round';
    context.fillStyle = '#fff';
    console.log(e);
    context.lineTo(e.clientX, e.clientY);
    context.stroke();
    context.beginPath();
    context.moveTo(e.clientX, e.clientY);
  };


  const { source } = useMemo(() => imageData, [imageData]);
  const img = new Image();
  img.src = source;
  img.onload = () => {
    setImgDimension({
      width: img.width,
      height: img.height,
    });
  };


  const convertImgUrlToBase64 = (blob) => new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });


  const processRetouch = async () => {
    setIsLoading(true);
    const base64Response = await fetch(source);
    const blob = await base64Response.blob();
    const result = await convertImgUrlToBase64(blob);
    const newResult = result.replace(/^data:image\/(jpeg|jpg|png);base64,/, '');
    const point = await endDraw();
    const data = {
      base64: newResult,
      rectangles: point,
    };
    console.log(data);
    clearCanvas();

    fetch('https://www.cutout.pro/api/v1/imageFix', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
      body: JSON.stringify(data),
    }).then((resp) =>
      // eslint-disable-next-line implicit-arrow-linebreak
      resp.json(),
    ).then(resp => {
      setImgSrc(resp.data.imageUrl);
      clearCanvas();
      setIsLoading(false);
      setIsProcessImage(true);
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

  const onLoadImage = useCallback(async (image) => {
    const result = await convertToBlob(image);

    if (!imgSrc) {
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
  }, [imgSrc]);



  const downloadRetouch = async () => {
    const base64Response = await fetch(imgSrc);
    const blob = await base64Response.blob();
    const result = await convertImgUrlToBase64(blob);
    triggerBase64Download(result, 'my_download');
  };


  return (
    <>
      <div className="">

        <div className="flex advance-editor-modal-content">
          <div className="content-container">
            <div className="flex justify-content-center items-center  ">
              <div className="">
                {isLoading ? <LibrarySpinner /> : null}
                <div className=" flex justify-content-center">
                  <ReactSketchCanvas
                    ref={canvasRef}
                    width={imgDimension.width}
                    height={imgDimension.height}
                    strokeWidth={10}
                    strokeColor="#79A3F1"
                    backgroundImage={isProcessImage ? imgSrc : source}
                    preserveBackgroundImageAspectRatio
                    // onChange={processRetouch}
                    // onStroke={processRetouch}
                    allowOnlyPointerTypes="mouse"
                    // onMouseUp={processRetouch}
                  />
                </div>
              </div>
            </div>
          </div>


          <div className="download-container">
            <button onClick={() => downloadRetouch()} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
              Download Image
            </button>

            <div className="flex">
              <button onClick={() => processRetouch()} className="btn btn-danger btn-sm mt-5 mr-4">
               Retouch Image
              </button>


              <button onClick={() => onLoadImage(imgSrc)} className="btn btn-primary   btn-xl mt-5 w">
              Save Image
              </button>
            </div>
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
