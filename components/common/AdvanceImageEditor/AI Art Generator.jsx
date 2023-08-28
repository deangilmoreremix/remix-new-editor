/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { triggerBase64Download } from 'react-base64-downloader';
import Carousel from 'react-simply-carousel';
import PropTypes from '../../../lib/PropTypes';
import useUserStore from '../../hooks/useUserStore';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';
import PercentageProgressBar from '../../media/PercentageProgressBar';
import { Popover, Tab, Tabs, Button, Menu, MenuItem } from '@material-ui/core';


const AIArtGenerator = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const { uploadMedia, storeAsset, uploadImageUrl } = useMediaStore();
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
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isError, setError] = useState(null);
  const { source } = useMemo(() => imageData, [imageData]);
  const [description, setDescription] = useState(null);
  const [active, setActive] = useState(null);
  const [imageHeight, setImageHeight] = useState(null);
  const [imageWidth, setImageWidth] = useState(null);
  const [size, setSize] = useState(null)
  const [style, setStyle] = useState(null);
  const [imageUploadedUrl, setImageUploadedUrl] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [inspiration, setInspiration] = useState('celebraties');
  const [activeOpt, setActiveOpt] = useState(null);
  // const [open,setOpen] = useState(false)

  const celebratiesArr = [
    "Elon Musk",
    "Cristiano Ronaldo",
    "Barak Obama",
    "Lionel Messi",
    "Kim Kardashian",
    "LeBron James",
    "Taylor Swift",
    "Neymar",
    "George Clooney",
    "Dwayne Johnson",
    "Johnny Depp",
    "Will Smith",
    "Beyoncé",
    "Billie Eilish",
    "DrakeElon Musk",
    "Cristiano Ronaldo",
    "Barak Obama",
    "Lionel Messi",
    "Kim Kardashian",
    "LeBron James",
    "Taylor Swift",
    "Drake",
    "Howard Stern",
    "Chris Evans",
    "Britney Spears",
    "Morgan Freeman",
    "Lady Gaga",
    "Sandra Bullock",
    "Jennifer Lopez",
    "Snoop Dogg",
    "Angelina Jolie",
    "Kylie Jenner",
    "Jim Carrey",
    "Emma Watson",
    "Justin Bieber",
    "Kamala Harris",
    "Adele",
    "Travis Scott",
    "Zendaya",
    "Nicki Minaj",
    "Rihanna",
    "Tom Holland",
    "Camila Cabello",
    "Jungkook",
    "Demi Lovato",
  ]
  const characterArr = [
    "A beautiful young woman",
    "Young man with short, ash blond hair",
    "A elegant necromancer girl",
    "African steampunk alchemist",
    "Male wizard with glowing eyes",
    "Portrait of a beautiful fit elf ranger",
    "Japanese girls wear fantasy yukata in festival",
    "Portrait of a Opal-haired goddess",
    "Dreamlike luxury stunning gothic young female",
    "Rusting tape machine robot",
    "A cyborg pilot in the cockpit of a battle droid",
    "Respectable dignified middle aged amish preacher",
    "Portrait of a proud aztec moon goddess",
    "Stylish woman wearing a black loose fit suit with a tie",
    "Young female black military uniform maid with a beret",
    "Portrait of dark muscular indian royal couple",
    "A young ruggedly handsome pirate",
    "A portrait of the handsome bearded king",
    "Amazon valkyrie Athena",
    "Female tennis player",
  ]
  const scenarioArr = [
    "An opulent marketplace street scene",
    "National Geographic landscape",
    "Futuristic utopian metropolis",
    "Inside an old magical sweet shop",
    "Atlantis, palaces underwater",
    "Beautiful hobbit house by the lake",
    "The apartment room in a cyberpunk city",
    "Chubby futuristic shop in the desert",
    "A demonic magical ethereal portal",
    "A shopping street in the Chinese imperial city",
    "An igloo in the tundra, with a campfire near the entrance",
    "Star fleet nautilus ship being prepared for launch",
    "Futuristic cyberpunk robot city",
    "A neoclassical city suspended with huge steel constructions",
    "A flourishing roman city"
  ]

  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };
  useEffect(() => quantify(), []);

  const sizeHandler = (event, newValue) => {
    setSize(newValue);
  }



  const handleClick = (event) => {
    console.log("clalll hguygu", event)
    setAnchorEl(event.currentTarget);
  };

  const handleTooltipClose = () => {
    setAnchorEl(null);
  };


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
      const data = {
        url: image
      }
      media = await uploadImageUrl(data);
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

  const processImage = async () => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
    const data = {
      prompt: description,
      ...(imageWidth && { width: imageWidth }),
      ...(imageHeight && { height: imageHeight }),
      ...(style && { style: style }),
      // ...(imageUploadedUrl && { imageUrl: imageUploadedUrl.url }),



    }
    fetch(`https://www.cutout.pro/api/v1/text2imageAsync`, {
      method: 'post',
      body: JSON.stringify(data),
      headers: {
        'Content-type': 'application/json',
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
          processAIImage(resp.data);
          setError(null);
          // talk to backend to reduce the use cutoutpro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
        showError('Something went wrong. Please try again later.');
      });
  };

  const processAIImage = async (val) => {
    const total = cutoutProCreditUserUsed + 2;
    setIsLoading(true);
    await fetch(`https://www.cutout.pro/api/v1/getText2imageResult?taskId=${val}`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: 'f8215a0e6b3b40b78a2ce62ce89c5d9e',
      },
    }).then((data) =>
      data.json(),
    ).then(async resp => {
      if (resp?.code == 9010) {
        setIsLoading(false);
        setError('The description information has failed the review and contains illegal content')
      }
      if (resp.data.status == 3 || resp.data.status == 0) {
        // setProgressState(100 - resp.data.waitNumber)
        processAIImage(val)
      }
      if (resp.data.status == 1) {
        setIsLoading(false);
        setIsProcessImage(true);
        // setProgressState(0);
        setNewImage(resp.data.resultUrl);
        updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
      }
    })
      .catch((error) => {
        console.log(error, "errrr")
        setIsLoading(false);
        showError('Something went wrong. Please try again later.');
      });
  }


  const changeBackgroundColor = (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
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
        if (resp.msg === 'Processing failed') {
          setError(resp.msg);
        } else {
          setNewImage(resp.data.imageBase64);
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
  const onChange = (event) => {
    const { value } = event.target;
    setDescription(value);
  };

  const characterArray = [
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/1-small.png', name: "Photographic" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/2-small.png', name: "Oil Painting" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/3-small.png', name: "J-Manga" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/4-small.png', name: "Elf" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/5-small.png', name: "Princess" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/6-small.png', name: "LoL" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/7-small.png', name: "Realistic Anime" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/8-small.png', name: "Matte Painting" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/9-small.png', name: "Dragon Horns" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/10-small.png', name: "Glowing Forest" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/11-small.png', name: "Office Lady" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/12-small.png', name: "Suit Thug" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/13-small.png', name: "Vector Art" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/14-small.png', name: "West Coast" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/15-small.png', name: "Blue Rhapsody" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/16-small.png', name: "Graffiti" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/17-small.png', name: "Clown" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/18-small.png', name: "Flat Comic" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/19-small.png', name: "R&M" },
    { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/20-small.png', name: "Shooter" },
    // 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/1-small.png'

  ]
  const scenarioStyle = [
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/1-small.png", name: "Realistic" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/2-small.png", name: "Concept Art" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/3-small.png", name: "Illustration" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/4-small.png", name: "Cartoon Store" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/5-small.png", name: "3D Game" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/6-small.png", name: "3D Room" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/7-small.png", name: "Poly" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/8-small.png", name: "Interior" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/9-small.png", name: "Ghibli" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/10-small.png", name: "Coffee Shop" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/11-small.png", name: "Sci-Fi" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/12-small.png", name: "Mechanical" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/13-small.png", name: "Starship" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/14-small.png", name: "Utopia" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/15-small.png", name: "Battle" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/16-small.png", name: "Cyber Room" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/17-small.png", name: "Adventure" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/18-small.png", name: "Chinese Style" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/19-small.png", name: "Fantasia" },
    { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/20-small.png", name: "Blue Flame" },


  ]
  const [styleArray, setStyleArray] = useState(characterArray)
  const base64 = `data:image/png;base64,${newImage}`;

  useEffect(() => {
    if (size == 'onebyone') {
      setImageHeight(512);
      setImageWidth(512);
    }
    if (size == 'threebyfour') {
      setImageHeight(1027);
      setImageWidth(768);
    }
    if (size == 'ninebysixteen') {
      setImageHeight(810);
      setImageWidth(540);
    }
    if (size == 'onebytwo') {
      setImageHeight(1024);
      setImageWidth(512);
    }
    if (size == 'fourbythree') {
      setImageHeight(1027);
      setImageWidth(768);
    }
    if (size == 'sixteenbynine') {
      setImageHeight(810);
      setImageWidth(540);
    }
  }, [size])

  const downloadImage = () => {
    saveAs(newImage, 'image.png');
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

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
          <div className="content-container ai-art-generator ">
            <div className="flex justify-content-center items-center  ">
              <div className="original-image-container ">
                {/* <p className="text-center font-weight-bold"> Original Image</p> */}
                {/* <div className=" flex justify-content-center ">
                  <img className="editor-image" src={source} />
                </div> */}
                <textarea
                  rows={17}
                  // {...getRootProps()}
                  className="text-input full-width-container"
                  value={description}
                  // onKeyPress={onKeyPress}
                  onChange={onChange}
                // placeholder={placeholder}
                />
                {/* <button className={'inspiration-button'} onClick={(e) => handleClick(e)}>inspiration</button> */}
                <Button aria-controls="simple-menu" aria-haspopup="true" className={'inspiration-button'} onClick={handleClick}>inspiration</Button>
                {/* <Menu
                  id="simple-menu"
                  anchorEl={anchorEl}
                  keepMounted
                  open={Boolean(anchorEl)}
                  onClose={handleTooltipClose}
                  className='toolip-root'
                >
                  <MenuItem onClick={handleTooltipClose}>Profile</MenuItem>
                  <MenuItem onClick={handleTooltipClose}>My account</MenuItem>
                  <MenuItem onClick={handleTooltipClose}>Logout</MenuItem>
                </Menu> */}
                <Popover
                  id={id}
                  open={open}
                  anchorEl={anchorEl}
                  onClose={handleTooltipClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                  }}

                  className='toolip-root'
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                  }}
                >
                  <div style={{ backgroundColor: "#1C1C26", border:'solid 1px #ef5054', padding:'5px', borderRadius:'5px' }}>
                    <p style={{ fontSize: '16px', fontWeight: '600px', textAlign: 'left', color: '#fff', fontWeight:'bold' }}>Inspiration</p>
                    <div style={{ display: 'flex', gap: '5px', justifyContent:'center',marginBottom:'5px' }}>
                      <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color:'#fff'  }} onClick={() => {
                        setInspiration('celebraties')
                        setActiveOpt(0)
                      }}>Celebrities</Button>
                      <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color:'#fff' }} onClick={() => {
                        setInspiration('character')
                        setActiveOpt(0)
                      }}>Character</Button>
                      <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color:'#fff' }} onClick={() => {
                        setInspiration('scenario')
                        setActiveOpt(0)
                      }}>Scenario</Button>
                    </div>
                    <div style={{ height: "200px", overflow: 'auto', textAlign:'center' }}>
                      {inspiration == 'celebraties' && celebratiesArr.map(((ele, index) => (
                        <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                          setDescription(ele)
                          setActiveOpt(index)
                        }}>
                          <p style={{ color:'#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                        </div>
                      )))
                      }

                      {inspiration == 'character' && characterArr.map(((ele, index) => (
                        <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                          setDescription(ele)
                          setActiveOpt(index)
                        }}>
                          <p style={{ color:'#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                        </div>
                      )))
                      }

                      {inspiration == 'scenario' && scenarioArr.map(((ele, index) => (
                        <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                          setDescription(ele)
                          setActiveOpt(index)
                        }}>
                          <p style={{ color:'#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                        </div>
                      )))
                      }
                    </div>
                  </div>
                </Popover>
                {/* <Button aria-describedby={id} variant="contained" color="primary" className='inspiration-button' onClick={handleClick}>
                  Open Popover
                </Button> */}
                {/* <Popover
                  id={id}
                  open={open}
                  anchorEl={anchorEl}
                  onClose={handleTooltipClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                  }}
                  className='toolip-root'
                >
                  <p>The content of the Popover.</p>
                </Popover> */}
                <p className='text-center'>Size</p>
                <Tabs
                  value={size}
                  onChange={sizeHandler}
                  aria-label="wrapped label tabs example"
                  className="size-container"
                >
                  <Tab value={'onebyone'} label={<div style={{ backgroundColor: "#fff", height: "25px", width: "25px", textAlign: "center", color: '#000' }}></div>} />
                  <Tab value={'threebyfour'} label={<div style={{ backgroundColor: "#fff", height: "41px", width: "27px", textAlign: "center", color: '#000' }}></div>} />
                  <Tab value={'ninebysixteen'} label={<div style={{ backgroundColor: "#fff", height: "47px", width: "25px", textAlign: "center", color: '#000' }}></div>} />
                  <Tab value={'onebytwo'} label={<div style={{ backgroundColor: "#fff", height: "53px", width: "21px", textAlign: "center", color: '#000' }}></div>} />
                  <Tab value={'fourbythree'} label={<div style={{ backgroundColor: "#fff", height: "27px", width: "41px", textAlign: "center", color: '#000' }}></div>} />
                  <Tab value={'sixteenbynine'} label={<div style={{ backgroundColor: "#fff", height: "25px", width: "47px", textAlign: "center", color: '#000' }}></div>} />
                </Tabs>
                <div className="flex justify-content-center ">
                  <div>
                    {cutoutProCreditAvailableBalance <= 0
                      ? (
                        null
                      )
                      : (
                        <button onClick={() => processImage()} className="btn  btn-outline-danger  btn-xl mt-5 w-full  w-100 btn-padding">
                          Generate Image
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image </p>
                <div className=" ">
                  {isLoading ? <div className="progressState">
                    <PercentageProgressBar />
                  </div> : (
                    <div className=" flex justify-content-center">
                      {isProcessImage
                        ? (
                          <img
                            className="editor-image"
                            src={newImage}
                          />
                        )
                        : <img className="editor-image" src={transparent} />}
                    </div>
                  )}
                </div>
                <button className='btn btn-outline-danger btn-xl mt-5 w-full  w-100 download-button' onClick={() => downloadImage()}>Download Image</button>
              </div>
            </div>
          </div>


          <div className="download-container ai-art-generator">
            <div className="style-container">
              <div className='style-button-container'>
                <button onClick={() => setStyleArray(characterArray)}>Character Style</button>
                <button onClick={() => setStyleArray(scenarioStyle)}>Scenario Style</button>
              </div>
              <div className='image-grid'>
                {styleArray.length && styleArray.map((ele, index) => (
                  <div onClick={() => {
                    setStyle(ele?.name)
                    setActive(index)
                  }}>
                    <img src={ele?.img} className={`${index == active ? 'active-style' : ''}`} />
                    <p style={{ fontSize: '11px' }}>{ele?.name}</p>
                  </div>
                ))
                }
              </div>
              {/* <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
              <div className="">
                {cutoutProCreditAvailableBalance <= 0
                  ? (
                    null
                  )
                  : (
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
                        },
                      }}
                      itemsToShow={12}
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
                      <button onClick={() => changeBackgroundColor('D8D9D8')} className="color-btn" style={{ backgroundColor: '#D8D9D8' }} />
                      <button onClick={() => changeBackgroundColor('BEE1E6')} className="color-btn" style={{ backgroundColor: '#BEE1E6' }} />
                      <button onClick={() => changeBackgroundColor('97F5E1')} className="color-btn" style={{ backgroundColor: '#97F5E1' }} />
                      <button onClick={() => changeBackgroundColor('EB5054')} className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                      <button onClick={() => changeBackgroundColor('E9C1CA')} className="color-btn" style={{ backgroundColor: '#E9C1CA' }} />
                      <button onClick={() => changeBackgroundColor('CFDFC2')} className="color-btn" style={{ backgroundColor: '#CFDFC2' }} />
                      <button onClick={() => changeBackgroundColor('EA2055')} className="color-btn" style={{ backgroundColor: '#EA2055' }} />
                      <button onClick={() => changeBackgroundColor('23ef56')} className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                      <button onClick={() => changeBackgroundColor('ffed45')} className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                    </Carousel>
                  )}

              </div> */}
            </div>

            {/* {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Download Image
                </button>
              )} */}
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

AIArtGenerator.propTypes = {
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

AIArtGenerator.defaultProps = {
  noCrop: false,
};

export default AIArtGenerator;
