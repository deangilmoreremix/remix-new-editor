import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import Grid from '@material-ui/core/Grid';
import { useAsync } from 'react-async-hook';
import classnames from 'classnames';
import hotkeys from 'hotkeys-js';

import Loader from './common/Loader';
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
import TextToSpeech from './media/TextToSpeech';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import Warning from './common/snackBars/Warning';
import Success from './common/snackBars/Success';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';
import { WINDOW_TYPES, SCREEN_RATIO } from '../lib/constants/ui';
import { ROUTES } from '../lib/constants/routing';
import AnimatedWindow from './common/AnimatedWindow';
import { TEMPLATE_GENERATOR_MODAL, SAFARI_WARNING_MODAL } from '../lib/constants/modals';

const Home = observer(() => {
  const { pathname, query: { project, remix }, push } = useRouter();
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
    templateGeneratorEnabled,
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
    socialFbEnabled,
    wrapperFeatureEnabled,
    textMaskEnabled,
  } = userStore;
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();
  const [shouldShowTGModal, setShouldShowTGModal] = useState(templateGeneratorEnabled);

  useEffect(() => {
    if (!project && pathname !== ROUTES.edit) {
      push({
        pathname: ROUTES.edit,
      },
      undefined,
      { shallow: true },
      )
        .finally(() => {
          if (shouldShowTGModal) {
            openModal(TEMPLATE_GENERATOR_MODAL);
          }
          setShouldShowTGModal(false);
        });
    } else {
      if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const isSafari = (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1);

        if (isSafari) {
          openModal(SAFARI_WARNING_MODAL);
        }
      }
      if (shouldShowTGModal && !project && !remix) {
        openModal(TEMPLATE_GENERATOR_MODAL);
      }
      setShouldShowTGModal(false);
    }
  }, [shouldShowTGModal, pathname, project, remix, push]);

  const asyncHero = useAsync(
    project
      ? projectStore.getOne
      : projectStore.preRemix,
    [project || remix, openModal],
  );

  const {
    changeRadioButton,
    secondaryWindowType,
    setSecondaryWindowType,
    checkboxRight,
    radioButtonBottom,
    openMediaButton,
    isTimelineOpen,
    setListBuilder,
    openCTA,
    openTextToSpeech,
    toggleRightBlock,
    openUploadTransition,
    showProducePanel,
    closeAllWindows,
    setInitialView,
    isCanvasPresent,
    toggleLeftBlock,
  } = uiStore;

  const {
    item: { ratio: { width, height } = DEFAULT_RATIO, allowedSocials, url: videoUrl },
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
    projectData,
    setIsRedirect,
    isRedirect,
  } = projectStore;

  hotkeys.filter = () => true;
  const keys = [twoKeys.ctrlS, twoKeys.ctrlZ, twoKeys.ctrlY, twoKeys.ctrlD,
    twoKeys.commandS, twoKeys.commandZ, twoKeys.commandY, twoKeys.commandD];

  React.useEffect(() => {
    hotkeys.unbind(keys.join(), hotkeys.getScope());
    hotkeys(keys.join(), (event, handler) => {
      switch (handler.key) {
        case twoKeys.ctrlS:
        case twoKeys.commandS:
          event.preventDefault();
          checkAndSave({
            changeRadioButton, showProducePanel, closeAllWindows, setInitialView,
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
        case twoKeys.ctrlD:
        case twoKeys.commandD: {
          event.preventDefault();
          let isStopCommand = true;

          event.target.classList.forEach(item => {
            if (item.indexOf('popcorn-element') !== -1) {
              isStopCommand = false;
            }
          });

          if (isStopCommand) {
            return null;
          }

          if (projectData.media && projectData.media.length && activeElementId) {
            projectData.media.forEach((media) => {
              media.tracks.forEach((track) => {
                track.trackEvents.forEach(trackEvent => {
                  if (trackEvent.id === activeElementId) {
                    addElement({
                      ...trackEvent.popcornOptions,
                      type: trackEvent.type,
                      track: null,
                      zindex: null,
                      blendMode: null,
                      opacity: null,
                      id: null,
                    });
                  }
                });
              });
            });
          }
          break;
        }
        default: return null;
      }
    });
  }, [activeElementId]);

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
            onSelect={(item, type) => updateAnimation(type, item)}
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
        return <TextToSpeech />;
      }
      default: {
        return null;
      }
    }
  }, [secondaryWindowType, updateAnimation, currentElement]);

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
        toggleRightBlock,
        openUploadTransition,
        toggleLeftBlock,
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
        socialFbEnabled,
        wrapperFeatureEnabled,
        textMaskEnabled,
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
    if (asyncHero && !asyncHero.loading) {
      setIsRedirect();
    }
  }, [asyncHero?.loading]);

  return (
    <React.Fragment>
      {(asyncHero.loading || isRedirect) && (
        <Loader isLoading preloader />
      )}
      {asyncHero.error && (
        <div>Error</div>
      )}
      {(!asyncHero.loading || isLoaded) && (
        <div className={classnames('home', { disabled: isLoading })}>
          { isLoading ? <div className="hover-loading" /> : null }
          <Loader isLoading={isLoading} />
          <Grid container className="controls">
            <div className={classnames('controls-block', { 'controls-block-library': !isCanvasPresent })} style={{ width: radioButtonBottom ? '60%' : 'auto' }}>
              <div className="controls-block__sidebar">
                <div className={classnames('controls-block__toolbar', { 'controls-block__toolbar-produce': radioButtonBottom })}>
                  <Toolbar
                    items={toolbarContent}
                  />
                </div>
                {checkboxRight && !radioButtonBottom && (
                  <div
                    className="home__center"
                  >
                    <AnimatedWindow isOpen={checkboxRight}>
                      {SecondaryWindow}
                    </AnimatedWindow>
                  </div>
                )}
              </div>
            </div>
            <div className={classnames('controls__canvas', { hidden: !isCanvasPresent })} style={{ width: '40%' }}>
              <Canvas />
            </div>
          </Grid>
          <SizeSelector sizes={CANVAS_SIZES} onChange={updateItem} active={{ width, height }} />
          <Grid container className={classnames('timeline', { 'timeline-open': isTimelineOpen })}>
            <Timeline />
          </Grid>
        </div>
      )}
      {warning && <Warning message={warning} />}
      {success && <Success message={success} />}
    </React.Fragment>
  );
});

export default Home;
