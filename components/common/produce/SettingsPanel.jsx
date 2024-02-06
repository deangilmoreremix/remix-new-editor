import React, { useState, useMemo, useEffect } from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import SVGInline from 'react-svg-inline';
import aiPromptIcon from '../../../public/static/svgImages/aiPrompt.svg';
import AiPoint from '../../../public/static/svgImages/AiPoint.svg';
import { LibrarySpinner } from '../../../components/media/Loader';
import PercentageProgressBar from '../../../components/media/PercentageProgressBar';
import AiPointImage from '../../../public/static/images/aiPoint.png';
import LinearProgress from '@material-ui/core/LinearProgress';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import PropTypes from '../../../lib/PropTypes';
import { rgba2hex } from '../../../lib/lottie/utils';
import Modal from 'react-bootstrap/Modal';
import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';
import useModalStore from '../../hooks/useModalStore';
import useUIStore from '../../hooks/useUIStore';
import FieldBuilder from '../../form/FieldBuilder';
import { Divider } from '@material-ui/core';
import { CROP_RECOMMENDED_RESOLUTION } from '../../../lib/constants/settings/image';
import { IMAGE_CROPPER_MODAL } from '../../../lib/constants/modals';
import { GIF_FORMAT, GIF_WARNING } from '../../../lib/constants/media';
import { produceTooltips } from '../../../lib/constants/tooltips';
import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project';

import DropAndEditButton from '../../media/DropAndEditButton';
import HelpIconComponent from '../HelpIcon';
import { WINDOW_TYPES } from '../../../lib/constants/ui';

const BorderLinearProgress = withStyles((theme) => ({
  root: {
    height: 10,
    borderRadius: 5,
  },
  colorPrimary: {
    backgroundColor:
      theme.palette.grey[theme.palette.type === 'light' ? 200 : 700],
  },
  bar: {
    borderRadius: 5,
    backgroundColor: '#52B52C',
  },
}))(LinearProgress);
const SettingPanel = observer(({ action }) => {
  const [isDisabledUpload, setIsDisabledUpload] = useState(false);
  const [showAibutton, setShowAibutton] = useState(false);
  const [openAiPrompt, setOpenAiPrompt] = useState(false);
  const [openAiPoint, setOpenAiPoint] = useState(false);
  const [isAiSuggesstionVisible, setIsAiSuggesstionVisible] = useState(false)
  const [aiPromptinput, setAiPromptinput] = useState(null);
  const [aiTitleSugeests, setAiTitleSugeests] = useState([]);
  const [aiTitlePoints, setAiTitlePoints] = useState({});
  const [openloader, setOpenloader] = useState(false);
  const [isPercentageLoader, setIsPercentageLoader] = useState(false)
  const [promptText, setPromptText] = useState(null);
  const aiTitleSugeest = [
    {
      type: 1,
      text: 'Exclusive Video Invitation for Doctors: Elevate Your Practice',
    },
    { type: 2, text: 'Exclusive Invitation: Elevate Your Medical Practice.' },
    {
      type: 3,
      text: 'Revolutionize paient care with our personalized videocampaign!',
    },
  ];

  const [showAiTitleSuggestion, setShowAiTitleSuggestion] = useState(false);

  const titleRef = React.useRef(null);

  const { linkedinEnabled, isSuperAdmin, smartAiArtGeneratorEnabled, aiTitleSuggestionsEnabled, aiDescriptionEnabled } =
    useUserStore();


  const {
    item,
    updateItem,
    updateCategories,
    clearAllCategories,
    removeCategory,
    releaseElement,
    AiGeneratoreImage,
    SettingImageUploded,
    setSettingImageUplode,
    SuggestEmailSubject,
    setSuggestEmailSubject,
    getSuggestEmailPoint,
    SuggestEmailPoint,
  } = useProjectStore();
  let {
    item: { allowedSocials = [] },
  } = useProjectStore();
  const { openImageEditor, closeModal, openImglyEditorCropper } =
    useModalStore();
  const { openAiArtGenerator, openMediaButton, setradiobuttonfalse, toggleVisibleCanvas } =
    useUIStore();
  const categories = useMemo(() => item.categories, [item.categories]);
  const updateSocials = (data) => {
    const socialValue = data[Object.keys(data)[0]];
    const socialKey = Object.keys(data)[0];

    if (socialValue && !allowedSocials.includes(socialKey)) {
      allowedSocials.push(socialKey);
    } else if (!socialValue && allowedSocials.includes(socialKey)) {
      allowedSocials = allowedSocials.filter(
        (allowedSocial) => allowedSocial !== socialKey
      );
    }
    updateItem({ allowedSocials });
  };
  const onUploadedImage = (image, type) => {
    updateItem({ thumbnail: image.url, type });
  };

  const [loader, setLoader] = useState(false)
  const onImageEdited = (thumbnail) => {
    updateItem({ thumbnail });
  };

  const openEditor = (image) => {
    closeModal(IMAGE_CROPPER_MODAL);
    openImglyEditorCropper({
      src: image || item.thumbnail,
      onImageEdited,
      startUpload: () => setIsDisabledUpload(true),
      endUpload: () => setIsDisabledUpload(false),
      noCrop: true,
    });
  };

  const { aiThumbnailEnabled } = useUserStore();
  console.log(aiThumbnailEnabled, 'sjaj');

  const handleChangeColor = (rgbColor) => {
    updateItem({
      [Object.keys(rgbColor).join()]: rgba2hex(Object.values(rgbColor).join()),
    });
  };
  const [suggestionText, setSuggestionText] = useState(null)
  useEffect(() => {
    if (window.location.pathname === '/edit' && window.location.search !== '') {
      if (item.thumbnail || SettingImageUploded) {
        setShowAibutton(true);
      }
    } else {
      if (SettingImageUploded) {
        setShowAibutton(true);
      }
    }
  }, [
    item,
    item.thumbnail,
    SettingImageUploded,
    showAibutton,
    window.location.pathname,
  ]);

  const handleGotoAIGenerator = () => {
    setSettingImageUplode(item.thumbnail);
    releaseElement();
    openMediaButton(WINDOW_TYPES.AI_ART_GENERATOR);
  };

  useEffect(() => {
    if (aiDescriptionEnabled || aiTitleSuggestionsEnabled) {
      setIsAiSuggesstionVisible(true)
    }
  }, [aiDescriptionEnabled, aiTitleSuggestionsEnabled])

  const handleAIPrompt = (text, suggText) => {
    if (showAiTitleSuggestion) {
      setShowAiTitleSuggestion(false)
      setAiTitlePoints({})
      setAiTitleSugeests([])
      setIsPercentageLoader(false)
    }
    setSuggestionText(suggText)
    setPromptText(text)
    setOpenAiPrompt(true);
  };
  const handlSaveAiPrompt = () => {
    setOpenAiPrompt(false);
    setOpenloader(true);
    SuggestEmailSubject(aiPromptinput);
  };
  const handleaiPromptInput = (e) => {
    setAiPromptinput(e.target.value);
  };
  const handleshowAiPoints = (item) => {
    setLoader(true)
    getSuggestEmailPoint(item);
  };
  React.useEffect(() => {
    const data = JSON.parse(JSON.stringify(SuggestEmailPoint));
    if (data) {
      setAiTitlePoints(data);
      setLoader(false)
    }
  }, [SuggestEmailPoint]);

  useEffect(() => {
    if (openAiPoint) {
      if (aiTitlePoints.points) {
        setIsPercentageLoader(false)
      }
      else {
        setIsPercentageLoader(true)
      }
    }
  }, [openAiPoint, aiTitlePoints])
  console.log('aiTitleSugeests>>', aiTitleSugeests.length);
  React.useEffect(() => {
    const data = JSON.parse(JSON.stringify(setSuggestEmailSubject));
    console.log('data>>>', data, data.length);
    if (data && data.length > 0) {
      setOpenAiPoint(true);
      setAiTitleSugeests(data);
      toggleVisibleCanvas(false)
      setShowAiTitleSuggestion(true);
      setOpenloader(false);
      setradiobuttonfalse(false);

    }
  }, [setSuggestEmailSubject]);

  const handleCLoseAiSuggestion = () => {
    setShowAiTitleSuggestion(false);
    setOpenloader(false);
    setradiobuttonfalse(true);
  };

  React.useEffect(() => {
    const produceTab = document.getElementsByClassName('produce__tab')[0];
    if (showAiTitleSuggestion || openloader) {
      produceTab.style.minWidth = '60%';
    } else {
      produceTab.style.minWidth = '45%';
    }
  }, [showAiTitleSuggestion, openloader]);
  return (
    <div className="produce-block settings-panel">
      <div
        className={
          showAiTitleSuggestion || openloader
            ? 'settings__inputs showAiTitleSuggestion'
            : 'settings__inputs'
        }
      >
        <div
          style={{ width: showAiTitleSuggestion ? '50%' : '' || (openloader && '100lvh') }}
        >
          <FieldBuilder
            ref={titleRef}
            isAiSuggesstionVisible={isAiSuggesstionVisible}
            type="input"
            name="title"
            label="Title"
            handlSaveAiPrompt={() => handleAIPrompt('Title Line Generator', 'AI Title Suggestions')}
            onChange={updateItem}
            value={item.title}
            className="settings-input"
            labelClassName="settings-panel-text"
            placeholder="My Perfect Video"
          />
          <FieldBuilder
            type="textarea"
            name="description"
            label="Description"
            isAiSuggesstionVisible={isAiSuggesstionVisible}
            handlSaveAiPrompt={() => handleAIPrompt('Description Line Generator', 'AI Description Suggestions')}
            text
            value={item.description}
            onChange={updateItem}
            className={`settings-input ${isAiSuggesstionVisible ? 'text-area-field' : ''}`}
            textClassName="settings-panel-text"
            placeholder="A project about"
            rows={5}
          />
          {isSuperAdmin && (
            <FieldBuilder
              type="input"
              name="preview"
              label="Preview"
              value={item.preview}
              onChange={updateItem}
              className="settings-input"
              textClassName="settings-panel-text"
              placeholder="Preview link"
            />
          )}
          <FieldBuilder
            type="color"
            name="background"
            onChange={handleChangeColor}
            value={item.background}
            label="Background Color"
            className="settings-formcolor"
          />
          <FieldBuilder
            type="checkbox"
            name="disabledPlaybar"
            label="Show playbar"
            value={!item.disabledPlaybar}
            onChange={() =>
              updateItem({ disabledPlaybar: !item.disabledPlaybar })
            }
            floatClassName="settings-checkbox settings-checkbox-playbar"
          />
          <div
            style={{
              display: 'flex',
              gap: '10px',
              width: '100%',
              justifyContent: 'left',
              marginTop: '25px',
            }}
          >
            {/* <Button
              style={{ width: '100%', padding: '0px 10px' }}
              className="settings__edit-file"
              onClick={handleAIPrompt}
            >
              AI Email Subject
            </Button>
            <Button
              style={{ width: '100%', padding: '0px 10px' }}
              className="settings__edit-file"
            >
              AI Mail-Tester
            </Button> */}
          </div>
        </div>
        {showAiTitleSuggestion && aiTitleSugeests.length > 0 && (
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} className="AiTitleSuggestion">
            <div>
              <p className="AITitle">{suggestionText}</p>
              <ol className="AISuggestions">
                {aiTitleSugeests.map((item) => {
                  return (
                    <li onClick={() => handleshowAiPoints(item)}>{item}</li>
                  );
                })}
              </ol>
            </div>
            {loader ?
              <PercentageProgressBar width="100%" /> :
              aiTitlePoints.points &&
              <div className="AiPointSuggestion">
                <div className="backpoint"></div>
                <img
                  style={{
                    height: '100%',
                    marginRight: '10px',
                    filter: 'brightness(1)',
                  }}
                  src={AiPointImage}
                  alt="pic"
                />
                <div className="pointContainer">
                  <>
                    {
                      <>
                        <p>{aiTitlePoints.points ? aiTitlePoints.points : "..."} Points</p>
                        {(
                          <BorderLinearProgress
                            variant="determinate"
                            value={aiTitlePoints.points}
                          />
                        )}
                        <p>{aiTitlePoints.text}</p></>

                    }
                  </>
                </div>
              </div>
            }
            <Button
              className="settings__edit-file AiTitleClose"
              onClick={handleCLoseAiSuggestion}
            >
              Close
            </Button>
          </div>
        )}
        {openloader && (
          <div style={{ margin: 'auto', width: '100lvh' }}>
            <LibrarySpinner />
          </div>
        )}
      </div>
      <div className="settings__inputs" style={{ flex: 1 }}>
        <FieldBuilder
          type="tags"
          name="tags"
          value={item.tags}
          onChange={updateItem}
          label="Tags"
          className="settings-input"
          titleClass="settings-panel-text"
          tooltipMessage={produceTooltips.tags}
          isTooltip
        />
        {isSuperAdmin && (
          <FieldBuilder
            type="multipleSelect"
            name="categories"
            label="Categories"
            items={categories}
            path="/api/make-categories"
            clear={clearAllCategories}
            addInput={updateCategories}
            removeInput={removeCategory}
          />
        )}
        <div className="settings-allow">
          <div className="settings-allow__label-box">
            <p className="settings-panel-text">Allow</p>
            <HelpIconComponent
              isText
              padding="0 1.56rem 0 0"
              height={25}
              message={produceTooltips.allow}
            />
          </div>
          <FieldBuilder
            type="checkbox"
            name="facebook"
            label="Facebook"
            value={
              item.allowedSocials &&
              item.allowedSocials.some((s) => s === 'facebook')
            }
            onChange={updateSocials}
            floatClassName="settings-checkbox"
          />
          {linkedinEnabled && (
            <FieldBuilder
              type="checkbox"
              name="linkedin"
              label="LinkedIn"
              value={
                item.allowedSocials &&
                item.allowedSocials.some((s) => s === 'linkedin')
              }
              onChange={updateSocials}
              floatClassName="settings-checkbox"
            />
          )}
        </div>

        <div className="settings__row">
          <div className="settings__row-block">
            <div className="settings__row-img">
              <p className="settings__row-text">Thumbnail</p>
              <div className="settings-img-preview">
                <img src={item.thumbnail} alt="" />
              </div>
            </div>
          </div>
          <div
            className="settings__row-block"
            style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}
          >
            {item.thumbnail && item.type !== GIF_FORMAT ? (
              <Button
                onClick={() => openEditor()}
                disableRipple
                disableFocusRipple
                disableTouchRipple
                className="settings__edit-file"
              >
                Image Editor
              </Button>
            ) : (
              <span className="settings__gif-message">{GIF_WARNING}</span>
            )}
            {aiThumbnailEnabled && showAibutton && (
              <Button
                onClick={() => handleGotoAIGenerator()}
                className="settings__edit-file"
              >
                AI Thumbnail
              </Button>
            )}
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__row-block">
            <div className="settings__first-row-block">
              <DropAndEditButton
                allowedGif
                onUploaded={onUploadedImage}
                isDisabled={isDisabledUpload}
                startUpload={() => setIsDisabledUpload(true)}
                endUpload={() => setIsDisabledUpload(false)}
                needSaveAsset={false}
                tooltipMessage={produceTooltips.thumbnailUpload}
                openImageEditor={(image) => openEditor(image)}
              />
            </div>
            <p className="settings__row-text-2">
              recommended image resolution
              {CROP_RECOMMENDED_RESOLUTION.width}x
              {CROP_RECOMMENDED_RESOLUTION.height}
            </p>
          </div>
          <div className="settings__row-block">
            <DropAndEditButton
              isArea
              allowedGif
              isRemovable={item.thumbnail !== DEFAULT_THUMBNAIL}
              fallbackValue={DEFAULT_THUMBNAIL}
              onUploaded={onUploadedImage}
              isDisabled={isDisabledUpload}
              value={item.thumbnail}
              startUpload={() => setIsDisabledUpload(true)}
              endUpload={() => setIsDisabledUpload(false)}
              needSaveAsset={false}
              openImageEditor={(image) => openEditor(image)}
              AiGeneratoreImage={AiGeneratoreImage}
            />
          </div>
        </div>
      </div>
      {openAiPrompt && (
        <Modal
          show={openAiPrompt}
          onHide={() => setOpenAiPrompt(false)}
          animation={false}
          className={'preview-model'}
        >
          <div
            className="preview-image-lt-container"
            style={{ padding: '10px 0px', marginTop: '0px', width: '30%' }}
          >
            <Modal.Header
              className="preview-header"
              style={{ paddingBottom: '10px' }}
            >
              <Modal.Title
                className="preview-title"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <SVGInline
                  className="library__icon-btn"
                  style={{ height: '40px', width: '41px' }}
                  svg={aiPromptIcon}
                />{' '}
                <span style={{ fontWeight: 600 }}>AI Prompt</span>
              </Modal.Title>
            </Modal.Header>
            <Divider style={{ height: '6px', background: '#2D2D3D' }} />
            <Modal.Body style={{ padding: '25px' }}>
              <p>{promptText}</p>
              <input
                className="library__search white-text-input Titlelinegenerator"
                type="text"
                value={aiPromptinput}
                onChange={handleaiPromptInput}
                placeholder="E.g. Personalized video content for doctors"
              />
            </Modal.Body>
            <Modal.Footer
              className="preview-footer"
              style={{ padding: '10px 20px', marginTop: '50px' }}
            >
              <Button
                className="preview-image-lt-use-button aipromptbutton"
                onClick={handlSaveAiPrompt}
                disabled={!aiPromptinput}
              >
                Generate
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      )}
    </div>
  );
});

SettingPanel.propTypes = {
  options: PropTypes.shape({
    focusTitle: PropTypes.bool,
  }),
};

export default SettingPanel;
