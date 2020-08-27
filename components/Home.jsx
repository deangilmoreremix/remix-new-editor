import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import Grid from '@material-ui/core/Grid';
import { useAsync } from 'react-async-hook';

import classnames from 'classnames';
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

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import Warning from './common/snackBars/Warning';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';
import { WINDOW_TYPES, SCREEN_RATIO } from '../lib/constants/ui';
import { ROUTES } from '../lib/constants/routing';
import AnimatedWindow from './common/AnimatedWindow';
import { TEMPLATE_GENERATOR_MODAL } from '../lib/constants/modals';

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
    jsonTransitionEnabled,
    googleMapsEnabled,
    socialFbEnabled,
  } = userStore;
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();
  const [shouldShowTGModal, setShouldShowTGModal] = useState(templateGeneratorEnabled);

  React.useEffect(() => {
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
      if (shouldShowTGModal && !project && !remix) {
        openModal(TEMPLATE_GENERATOR_MODAL);
      }
      setShouldShowTGModal(false);
    }
  }, [shouldShowTGModal, pathname, project, remix, push]);

  const asyncHero = useAsync(
    project
      ? projectStore.getOne
      : projectStore.remixOne,
    [project || remix],
  );

  const {
    setLibraryType,
    openLowerThird,
    changeRadioButton,
    secondaryWindowType,
    openStickers,
    setSecondaryWindowType,
    checkboxRight,
    radioButtonBottom,
    openMediaButton,
    isTimelineOpen,
    canvasWidth,
    toolsWidth,
    setListBuilder,
    toggleRightBlock,
    openUploadTransition,
    openToolbarElement,
    openGif,
    openSticker,
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
    element,
    retarget,
    activeElementId,
  } = projectStore;

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
      case WINDOW_TYPES.IMAGE: {
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
        setLibraryType,
        openStickers,
        openLowerThird,
        changeRadioButton,
        addElement,
        addRetargetForm,
        setListBuilder,
        setSecondaryWindowType,
        openMediaButton,
        toggleRightBlock,
        openUploadTransition,
        openToolbarElement,
        openGif,
        openSticker,
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
        jsonTransitionEnabled,
        width,
        height,
        googleMapsEnabled,
        socialFbEnabled,
      },
    });
    return items && items.length ? items : [];
  }, [
    openModal,
    closeModal,
    setLibraryType,
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

  return (
    <React.Fragment>
      {(asyncHero.loading) && (
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
            <Grid item xs={toolsWidth} className="controls-block">
              <Grid container>

                <Grid item xs={radioButtonBottom ? 12 : 6} style={{ maxWidth: radioButtonBottom ? '100%' : '23.3em', flexBasis: !radioButtonBottom && 'auto' }}>
                  <Toolbar
                    items={toolbarContent}
                  />
                </Grid>

                {checkboxRight && !radioButtonBottom && (
                  <Grid item xs={radioButtonBottom ? false : 6} className="home__center" style={{ flex: 1, maxWidth: 'none' }}>
                    <AnimatedWindow isOpen={checkboxRight}>
                      {SecondaryWindow}
                    </AnimatedWindow>
                  </Grid>
                )}

              </Grid>
            </Grid>
            <Grid item xs={canvasWidth}>
              <Canvas />
            </Grid>
          </Grid>
          <SizeSelector sizes={CANVAS_SIZES} onChange={updateItem} active={{ width, height }} />
          <Grid container className={classnames('timeline', { 'timeline-open': isTimelineOpen })}>
            <Timeline />
          </Grid>
        </div>
      )}
      {warning && <Warning message={warning} />}
    </React.Fragment>
  );
});

export default Home;
