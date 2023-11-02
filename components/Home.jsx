import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import Grid from '@material-ui/core/Grid';
import { useAsync } from 'react-async-hook';
import classnames from 'classnames';
import hotkeys from 'hotkeys-js';

import Loader from './common/Loader';
import { showInfo } from '../lib/services/alertService';
import Canvas from './Canvas';
import Timeline from './Timeline';
import Library from './media/Library';
import BlendModeLibrary from './media/BlendModeLibrary';
import Stickers from './media/Stickers';
import LowerThirds from './media/LowerThirds';
import Overlay from './media/OverlayListTransitions';
import Toolbar from './common/toolbar/Toolbar';
import SizeSelector from './canvas/SizeSelector';
import AnimationList from './media/AnimationList';
import SettingsEditor from './common/SettingsEditor';
import Recorder from './common/recorder/Recorder';
import CallToAction from './media/CallToAction';
import Giphy from './media/Giphy';
import { twoKeys } from '../lib/constants/keyCodes';
import GoogleTextToSpeech from './media/GoogleTextToSpeech';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';
import useTimelineStore from './hooks/useTimelineStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import Warning from './common/snackBars/Warning';
import Success from './common/snackBars/Success';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';
import { WINDOW_TYPES, SCREEN_RATIO } from '../lib/constants/ui';
import { ROUTES } from '../lib/constants/routing';
import AnimatedWindow from './common/AnimatedWindow';
import {
  TEMPLATE_GENERATOR_MODAL,
  SAFARI_WARNING_MODAL,
} from '../lib/constants/modals';
import AiArtGenerator from './modals/AiArtGenerator';
import BackgroundDiffusion from './modals/BackgroundDiffusion';
import PercentageProgressBar from './media/PercentageProgressBar';
import { Typography } from '@material-ui/core';

const Home = observer(() => {
  const {
    pathname,
    query: { project, remix,  isAiArtGenerator, isBgDiffusion },
    push,
  } = useRouter();
  const projectStore = useProjectStore();

  const userStore = useUserStore();

  const {
    optinCodeEnabled,
    isSuperAdmin,
    isfeatureEnabled,
    recorderEnabled,
    stickersEnabled,
    lowerThirdsEnabled,
    presetsEnabled,
    videoAutomationCreatorEnabled,
    linkedinEnabled,
    ctaEnabled,
    blendModeEnabled,
    connectEnabled,
    gifsEnabled,
    libraryStickerEnabled,
    jsonTransitionEnabled,
    textToSpeechStandardEnabled,
    textToSpeechNeuralEnabled,
    textToSpeechLimitedEnabled,
    leadGeneratorEnabled,
    googleMapsEnabled,
    smartAiArtGeneratorEnabled,
    smartBgDeffusionEnabled,
    collborateEnabled,
    socialFbEnabled,
    wrapperFeatureEnabled,
    textMaskEnabled,
    roles,
    currentUser,
    publishEnabled,
    evolutionOverlayEnabled,
    evolutionPresetEnabled,
    evolutionBlendModeEnabled,
    evolutionLowerThirdEnabled,
    evolutionCtaEnabled,
    evolutionImageLTPresetEnabled,
    retroLTEnabled,
    neonLTEnabled,
    neonSocialMediaLTEnabled,
    socialMediaLTEnabled,
    locationTitlesEnabled,
    socialMediaIcon3DEnabled,
    callOutTitlePageEnabled,
    neonArrowPackEnabled,
    socialMediaPackEnabled,
    socialMediaButtonPackEnabled,
    endScreensEnabled,
    getSvrTerms,
  } = userStore;
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();
  const [shouldShowTGModal, setShouldShowTGModal] = useState(
    videoAutomationCreatorEnabled,
  );
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const { isLoadingIosProcess } = useProjectStore();
  const {
    changeRadioButton,
    secondaryWindowType,
    setSecondaryWindowType,
    checkboxRight,
    radioButtonBottom,
    openMediaButton,
    setListBuilder,
    openCTA,
    openTextToSpeech,
    openAiArtGenerator,
    toggleRightBlock,
    openUploadTransition,
    showProducePanel,
    closeAllWindows,
    setInitialView,
    isCanvasPresent,
    toggleLeftBlock,
    addTogetherJS,
    isEnabled
  } = uiStore;
  const {
    item: {
      ratio: { width, height } = DEFAULT_RATIO,
      allowedSocials,
      url: videoUrl,
    },
    updateItem,
    updateAnimation,
    isLoading,
    isLoaded,
    addElement,
    modified,
    addRetargetForm,
    releaseElement,
    warning,
    success,
    element,
    retarget,
    activeElementId,
    checkAndSave,
    undoRedoAction,
    setIsRedirect,
    isRedirect,
    getElementById,
    createCombinedItem,
    destroyCombinedItem,
    popcorn,
    item,
    setButtonType
  } = projectStore;

  const toolbarContent = React.useMemo(() => {
    const items = toolbarItems({
      actions: {
        openModal,
        closeModal,
        changeRadioButton,
        addElement,
        addRetargetForm,
        setListBuilder,
        setSecondaryWindowType,
        openMediaButton,
        openCTA,
        openTextToSpeech,
        openAiArtGenerator,
        toggleRightBlock,
        openUploadTransition,
        toggleLeftBlock,
        addTogetherJS,
      },
      project: {
        allowedSocials,
        modified,
        optinCodeEnabled,
        videoUrl,
        userStore,
        releaseElement,
        isSuperAdmin,
        isfeatureEnabled,
        recorderEnabled,
        stickersEnabled,
        lowerThirdsEnabled,
        presetsEnabled,
        linkedinEnabled,
        ctaEnabled,
        blendModeEnabled,
        connectEnabled,
        gifsEnabled,
        libraryStickerEnabled,
        leadGeneratorEnabled,
        jsonTransitionEnabled,
        width,
        height,
        textToSpeechStandardEnabled,
        textToSpeechNeuralEnabled,
        textToSpeechLimitedEnabled,
        googleMapsEnabled,
        smartAiArtGeneratorEnabled,
        smartBgDeffusionEnabled,
        collborateEnabled,
        socialFbEnabled,
        wrapperFeatureEnabled,
        textMaskEnabled,
        evolutionOverlayEnabled,
        evolutionPresetEnabled,
        evolutionBlendModeEnabled,
        evolutionLowerThirdEnabled,
        evolutionCtaEnabled,
        evolutionImageLTPresetEnabled,
        retroLTEnabled,
        neonLTEnabled,
        neonSocialMediaLTEnabled,
        socialMediaLTEnabled,
        locationTitlesEnabled,
        socialMediaIcon3DEnabled,
        callOutTitlePageEnabled,
        neonArrowPackEnabled,
        socialMediaPackEnabled,
        socialMediaButtonPackEnabled,
        endScreensEnabled,
      },
    });

    return items && items.length ? items : [];
  }, [
    openModal,
    closeModal,
    changeRadioButton,
    addElement,
    optinCodeEnabled,
    modified,
    videoUrl,
    userStore,
    allowedSocials,
    linkedinEnabled,
    width,
    height,
  ]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = './static/js/togetherjs/togetherjs-min.js';
    script.async = true;
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (isEnabled == true) {
      if (!project && !remix) {
        showInfo('Please save a project');
        return false
      }
      push(`/edit/?remix=${project ? project : remix}`)
      TogetherJS();
    }
  }, [isEnabled])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgressMessage('Project is saving...');
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          setProgressMessage('Project saved, ready for sharing.')
          clearInterval(interval); // Stop the progress bar when it reaches 100%
          return 100;
        }
        return prevProgress + 1;
      });
    }, 1000); // Increment progress every 1200ms (2 minutes)

    return () => {

      clearInterval(interval); // Clean up the interval on component unmount
    };
  }, [progress]);


  useEffect(() => {
    if (getSvrTerms === false) {
      push(
        {
          pathname: ROUTES.terms,
        },
        undefined,
        { shallow: true },
      );
    } else if (!project && pathname !== ROUTES.edit) {
      push(
        {
          pathname: ROUTES.edit,
        },
        undefined,
        { shallow: true },
      ).finally(() => {
        if (shouldShowTGModal && !isAiArtGenerator && !isBgDiffusion) {
          openModal(TEMPLATE_GENERATOR_MODAL);
        }
        setShouldShowTGModal(false);
      });
    } else {
      if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const isSafari = ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1;

        if (isSafari) {
          openModal(SAFARI_WARNING_MODAL);
        }
      }
      if (shouldShowTGModal && !project && !remix && !isAiArtGenerator && !isBgDiffusion) {
        openModal(TEMPLATE_GENERATOR_MODAL);
      }
      setShouldShowTGModal(false);
    }
  }, [shouldShowTGModal, pathname, project, remix, push]);

  const asyncHero = useAsync(
    project ? projectStore.getOne : projectStore.preRemix,
    [project || remix, openModal],
  );

  const { setCopiedItems, pasteElement, isActiveTimeline } = useTimelineStore();
  hotkeys.filter = () => true;

  const keys = [
    twoKeys.ctrlS,
    twoKeys.ctrlZ,
    twoKeys.ctrlY,
    twoKeys.commandS,
    twoKeys.commandZ,
    twoKeys.commandY,
    twoKeys.ctrlC,
    twoKeys.commandC,
    twoKeys.ctrlV,
    twoKeys.commandV,
    twoKeys.ctrlD,
    twoKeys.commandD,
    twoKeys.ctrlO,
    twoKeys.commandO,
    twoKeys.ctrlP,
    twoKeys.commandP,
  ];

  React.useEffect(() => {
    hotkeys.unbind(keys.join(), hotkeys.getScope());
    hotkeys(keys.join(), (event, handler) => {
      switch (handler.key) {
        case twoKeys.ctrlS:
        case twoKeys.commandS:
          event.preventDefault();
          checkAndSave({
            changeRadioButton,
            showProducePanel,
            closeAllWindows,
            setInitialView,
          });
          break;
        case twoKeys.ctrlZ:
        case twoKeys.commandZ:
          event.preventDefault();
          undoRedoAction(true);
          break;
        case twoKeys.ctrlY:
        case twoKeys.commandY:
          event.preventDefault();
          undoRedoAction(false);
          break;
        case twoKeys.ctrlC:
        case twoKeys.commandC: {
          if (isActiveTimeline) {
            event.preventDefault();
            setCopiedItems();
          }
          break;
        }
        case twoKeys.ctrlV:
        case twoKeys.commandV: {
          if (isActiveTimeline) {
            pasteElement();
          }
          break;
        }
        case twoKeys.ctrlD:
        case twoKeys.commandD: {
          event.preventDefault();
          if (!isActiveTimeline) {
            return null;
          }

          if (activeElementId) {
            const selectedItem = getElementById(activeElementId);
            addElement({
              ...selectedItem.popcornOptions,
              type: selectedItem.type,
              track: null,
              blendMode: null,
              opacity: null,
              id: null,
            });
          }
          break;
        }
        case twoKeys.ctrlO:
        case twoKeys.commandO: {
          event.preventDefault();
          createCombinedItem();
          break;
        }
        case twoKeys.ctrlP:
        case twoKeys.commandP: {
          event.preventDefault();
          destroyCombinedItem();
          break;
        }
        default:
          return null;
      }
    });

    hotkeys('*', { keyup: true }, (event) => {
      if (hotkeys.ctrl && event.type === 'keyup') {
        const videoContainer = popcorn.target;
        const canvasItems = videoContainer
          ? videoContainer.querySelectorAll('.canvas-multiselected-item')
          : null;
        if (canvasItems) {
          canvasItems.forEach((canvasItem) => {
            canvasItem.style.pointerEvents = 'auto';
          });
        }
      }
    });
  }, [activeElementId, isActiveTimeline]);



  const currentElement = useMemo(() => {
    if (retarget) {
      if (retarget.id !== activeElementId) {
        return element;
      } else {
        return { ...retarget, popcornOptions: retarget.options };
      }
    }
    return element;
  }, [element, retarget, activeElementId]);

  const SecondaryWindow = React.useMemo(() => {
    switch (secondaryWindowType) {
      case WINDOW_TYPES.SETTING: {
        return <SettingsEditor />;
      }
      case WINDOW_TYPES.ANIMATION: {
        return (
          <AnimationList
            onSelect={(el, type) => updateAnimation(type, el)}
            element={currentElement}
          />
        );
      }
      case WINDOW_TYPES.VIDEO:
      case WINDOW_TYPES.AUDIO:
      case WINDOW_TYPES.IMAGE:
      case WINDOW_TYPES.VOICE: {
        return <Library />;
      }
      case WINDOW_TYPES.STICKERS.value:
      case WINDOW_TYPES.ANIMATED_EMOJI.value:
      case WINDOW_TYPES.STATIC_EMOJI.value:
      case WINDOW_TYPES.FLAGS.value:
        return <Stickers />;
      case WINDOW_TYPES.LOWER_THIRDS.value:
      case WINDOW_TYPES.PRESETS.value: {
        return <LowerThirds />;
      }
      case SCREEN_RATIO['16:9'].value:
      case SCREEN_RATIO['9:16'].value:
      case SCREEN_RATIO['4:5'].value:
      case SCREEN_RATIO['1:1'].value: {
        return <Overlay />;
      }
      case WINDOW_TYPES.RECORDER: {
        return <Recorder />;
      }
      case WINDOW_TYPES.CTA: {
        return <CallToAction />;
      }
      case WINDOW_TYPES.BLEND_MODE_LIBRARY: {
        return <BlendModeLibrary />;
      }
      case WINDOW_TYPES.GIF: {
        return <Giphy type="gifs" />;
      }
      case WINDOW_TYPES.STICKER: {
        return <Giphy type="stickers" />;
      }
      case WINDOW_TYPES.TEXT_TO_SPEECH: {
        return <GoogleTextToSpeech />;
      }
      case WINDOW_TYPES.AI_ART_GENERATOR: {
        return <AiArtGenerator />;
      }
      case WINDOW_TYPES.BG_DIFFUSION: {
        return <BackgroundDiffusion />;
      }
      default: {
        return null;
      }
    }
  }, [secondaryWindowType, updateAnimation, currentElement]);


  useEffect(() => {
    if (asyncHero && !asyncHero.loading) {
      setIsRedirect();
    }
  }, [asyncHero?.loading]);

  useEffect(() => {
    try {
      if (window && window.userpilot && item?.tags && roles) {
        window.userpilot.identify(currentUser.id, {
          name: currentUser.fullName,
          email: currentUser.email,
          created_at: moment(currentUser.createdAt).format('X'),
          roles: roles.map(({ name }) => name).join(', '),
          tags: item.tags.map((tag) => tag).join(', '),
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [item?.tags, roles]);

  return (
    <React.Fragment>
      {(asyncHero.loading || isRedirect) && <Loader isLoading preloader />}
      {asyncHero.error && <div>Error</div>}
      {(!asyncHero.loading || isLoaded) && (
        <div className={classnames('home', { disabled: isLoading })}>
          {isLoading ? <div className="hover-loading" /> : null}
          <Loader isLoading={isLoading} />
          <Grid container className="controls">
            <div
              className={classnames('controls-block', {
                'controls-block-library': !isCanvasPresent,
              })}
              style={{ width: radioButtonBottom ? '60%' : 'auto' }}
            >
              <div className="controls-block__sidebar">
                <div
                  className={classnames('controls-block__toolbar', {
                    'controls-block__toolbar-produce': radioButtonBottom,
                  })}
                >
                  <Toolbar items={toolbarContent} />
                </div>
                {checkboxRight && !radioButtonBottom && (
                  <div className="home__center">
                    <AnimatedWindow isOpen={checkboxRight}>
                      {SecondaryWindow}
                    </AnimatedWindow>
                  </div>
                )}
              </div>
            </div>
            <div
              className={classnames('controls__canvas', {
                hidden: !isCanvasPresent,
              })}
              style={{ width: '40%' }}
            >
              <Canvas />
            </div>
          </Grid>
          <SizeSelector
            sizes={CANVAS_SIZES}
            onChange={updateItem}
            active={{ width, height }}
          />
          {isLoadingIosProcess &&
            <div style={{ position: 'absolute', bottom: '60px', right: '20px' }}>
              <Typography style={{ width: 200, fontSize: '12px', fontWeight: 'bold' }}>{progressMessage}</Typography>
              <PercentageProgressBar width={200} progress={progress} />
            </div>
          }
          <Timeline />
        </div>
      )}
      {warning && <Warning message={warning} />}
      {success && <Success message={success} />}
    </React.Fragment>
  );
});

export default Home;
