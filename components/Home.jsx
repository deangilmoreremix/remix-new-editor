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
import GuidelinesActivation from './common/GuidelinesActivation';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import { CANVAS_SIZES } from '../lib/constants/media';
import { DEFAULT_RATIO } from '../lib/constants/project';

const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
  const projectStore = useProjectStore();
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();

  const { libraryType, showAnimation, setLibraryType, wideWindow, setWideWindow } = uiStore;

  const { updateAnimation, isLoading } = projectStore;

  const asyncHero = useAsync(getOne, [projectStore, project]);

  const { item: { ratio: { width, height } = DEFAULT_RATIO }, updateItem } = projectStore;

  if (asyncHero.loading || isLoading) {
    // todo implement loading
    return (<div>Loading</div>);
  }

  if (asyncHero.error) {
    // todo implement err message
    return (<div>Error</div>);
  }

  return (
    <div className="home">
      <Grid container className="controls">
        <Grid item xs={7}>
          <Grid container>
            <Grid item xs={wideWindow ? 12 : 6}>
              <Toolbar
                items={toolbarItems({
                  actions: {
                    openModal,
                    closeModal,
                    setLibraryType,
                    setWideWindow,
                  },
                })}
              />
            </Grid>
            <Grid item xs={wideWindow ? false : 6} className="home__center">
              {libraryType && <Library tab={libraryType} />}
              {
                showAnimation
                && <AnimationList onSelect={(item, type) => updateAnimation(type, item)} />
              }
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={5}>
          <GuidelinesActivation />
          <Canvas />
        </Grid>
      </Grid>
      <SizeSelector sizes={CANVAS_SIZES} onChange={updateItem} active={{ width, height }} />
      <Grid container className="timeline">
        <Timeline />
      </Grid>
    </div>
  );
});

export default Home;
