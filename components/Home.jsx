import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import Grid from '@material-ui/core/Grid';
import { useAsync } from 'react-async-hook';
import { CircleLoader } from 'react-spinners';
// import { withErrorHandler } from 'react-error-handler';

import classnames from 'classnames';
import Canvas from './Canvas';
import Timeline from './Timeline';
import Library from './media/Library';
import Stickers from './media/Stickers';
import LowerThirds from './media/LowerThirds';
import Toolbar from './common/toolbar/Toolbar';
import SizeSelector from './canvas/SizeSelector';
import AnimationList from './media/AnimationList';
import SettingsEditor from './common/SettingsEditor';
import Recorder from './common/recorder/Recorder';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';
import { LOADING_COLOR, WINDOW_TYPES } from '../lib/constants/ui';
import { ROUTES } from '../lib/constants/routing';
import AnimatedWindow from './common/AnimatedWindow';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    console.log("getDerivedStateFromError", error);
    // Обновить состояние с тем, чтобы следующий рендер показал запасной UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Можно также сохранить информацию об ошибке в соответствующую службу журнала ошибок
    console.log("componentDidCatch", error, errorInfo);
  }

  render() {
    return this.props.children;
  }
}

const Home = observer(() => {
  const { pathname, query: { project, remix }, push } = useRouter();
  const projectStore = useProjectStore();
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();

  React.useEffect(() => {
    if (!project && pathname !== ROUTES.edit) {
      push({
        pathname: ROUTES.edit,
      },
      undefined,
      { shallow: true },
      );
    }
  }, [pathname, project, push]);

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
  } = uiStore;

  const {
    item: { ratio: { width, height } = DEFAULT_RATIO, allowedSocials },
    updateItem,
    updateAnimation,
    isLoading,
    isLoaded,
    addElement,
    modified,
    addRetargetForm,
    releaseElement,
    videoUrl,
  } = projectStore;

  const userStore = useUserStore();

  const { optinCodeEnabled, isSuperAdmin, isfeatureEnabled, recorderEnabled } = userStore;

  const SecondaryWindow = React.useMemo(() => {
    switch (secondaryWindowType) {
      case WINDOW_TYPES.SETTING: {
        return <SettingsEditor />;
      }
      case WINDOW_TYPES.ANIMATION: {
        return <AnimationList onSelect={(item, type) => updateAnimation(type, item)} />;
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
      case WINDOW_TYPES.RECORDER: {
        return <Recorder />;
      }
      default: {
        return null;
      }
    }
  }, [secondaryWindowType, updateAnimation]);

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
        setSecondaryWindowType,
        openMediaButton,
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
  ]);

  return (
    <ErrorBoundary>
      {(asyncHero.loading) && ( // todo implement loading
        <CircleLoader
          size={100}
          class="loading"
          css={{
            margin: 'auto',
            position: 'absolute',
            top: 0,
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 10000,
          }}
          loading
          color={LOADING_COLOR}
        />
      )}
      {asyncHero.error && ( // todo implement err message
        <div>Error</div>
      )}
      {(!asyncHero.loading || isLoaded) && (
        <div className={classnames('home', { disabled: isLoading })}>
          { isLoading ? <div className="hover-loading" /> : null }
          <CircleLoader
            size={100}
            class="loading"
            css={{
              margin: 'auto',
              position: 'absolute',
              top: 0,
              bottom: '0',
              left: '0',
              right: '0',
              zIndex: 10000,
            }}
            loading={isLoading}
            color={LOADING_COLOR}
          />
          <Grid container className="controls">
            <Grid item xs={toolsWidth} style={{ minWidth: '105px' }}>
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
    </ErrorBoundary>
  );
});

export default Home;
