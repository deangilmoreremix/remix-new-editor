import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Grid } from '@material-ui/core';

import Header from './Header';
import Canvas from './Canvas';
import Toolbar from './common/toolbar/Toolbar';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import PlayButton from './common/timeline/PlayButton';
import MediaContainer from './media/MediaContainer';

const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
  const { openModal, closeModal } = useModalStore();
  const projectStore = useProjectStore();
  const asyncHero = useAsync(getOne, [projectStore, project]);

  if (asyncHero.loading) {
    // todo implement loading
    return (<div>Loading</div>);
  }

  if (asyncHero.error) {
    // todo implement err message
    return (<div>Error</div>);
  }

  return (
    <React.Fragment>
      <Grid container spacing={0} className="top-wrapper">
        <Header />
        <Grid item container xs={7} spacing={0}>
          <Grid item xs={6} className="top-wrapper-item toolbar">
            <Toolbar
              items={toolbarItems({
                actions: {
                  openModal,
                  closeModal,
                },
              })}
            />
          </Grid>
          <Grid item xs={6} className="top-wrapper-item media">
            <MediaContainer />
          </Grid>
        </Grid>
        <Grid item xs={5} className="top-wrapper-item canvas">
          <Canvas />
        </Grid>
      </Grid>
      <PlayButton />
    </React.Fragment>
  );
});

export default Home;
