import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import Grid from '@material-ui/core/Grid';

import Canvas from './Canvas';
import Timeline from './Timeline';
import Library from './media/Library';
import Toolbar from './common/toolbar/Toolbar';
import SizeSelector from './canvas/SizeSelector';
import AnimationList from './media/AnimationList';
import SettingsEditor from './common/SettingsEditor';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';
import { WINDOW_TYPES } from '../lib/constants/ui';
import { ROUTES } from '../lib/constants/routing';

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
  }, []);

  const asyncHero = useAsync(
    project
      ? projectStore.getOne
      : projectStore.remixOne,
    [project || remix],
  );

  const {
    setLibraryType,
    wideWindow,
    setWideWindow,
    secondaryWindowType,
  } = uiStore;

  const {
    item: { ratio: { width, height } = DEFAULT_RATIO, allowedSocials },
    updateItem,
    updateAnimation,
    isLoading,
    isLoaded,
    addElement,
    modified,
  } = projectStore;

  const userStore = useUserStore();

  const { optinCodeEnabled } = userStore;

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
        setWideWindow,
        addElement,
      },
      project: {
        allowedSocials,
        modified,
        optinCodeEnabled,
      },
    });
    return items && items.length ? items : [];
  }, [
    openModal,
    closeModal,
    setLibraryType,
    setWideWindow,
    addElement,
    optinCodeEnabled,
    modified,
  ]);

  return (
    <React.Fragment>
      {(asyncHero.loading || isLoading) && ( // todo implement loading
        <div>Loading</div>
      )}
      {asyncHero.error && ( // todo implement err message
        <div>Error</div>
      )}
      {(!asyncHero.loading || isLoaded) && (
        <div className="home">
          <Grid container className="controls">
            <Grid item xs={7}>
              <Grid container>
                <Grid item xs={wideWindow ? 12 : 6}>
                  <Toolbar
                    items={toolbarContent}
                  />
                </Grid>
                <Grid item xs={wideWindow ? false : 6} className="home__center">
                  {SecondaryWindow}
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={5}>
              <Canvas />
            </Grid>
          </Grid>
          <SizeSelector sizes={CANVAS_SIZES} onChange={updateItem} active={{ width, height }} />
          <Grid container className="timeline">
            <Timeline />
          </Grid>
        </div>
      )}
    </React.Fragment>
  );
});

export default Home;
