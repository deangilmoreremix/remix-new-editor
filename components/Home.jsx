import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Col, Container, Row } from 'reactstrap';

import Header from './Header';
import Canvas from './Canvas';
import Toolbar from './common/toolbar/Toolbar';
import useProjectStore from './hooks/useProjectStore';
import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import PlayButton from './common/timeline/PlayButton';
import LibraryLayout from "./LibraryLayout";

const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
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
    <Container fluid className="home">
      <Header />
      <Row className="controls" noGutters>
        <Col xs={7}>
          <Row>
            <Col xs={6}>
              <Toolbar items={toolbarItems} />
            </Col>
            <Col xs={6}>
          Hi!
            </Col>
          </Row>
        </Col>
        <Col xs={5}>
          <Canvas />
        </Col>
        <PlayButton />
      </Row>
      <Row className="timeline" noGutters />
      <LibraryLayout />
    </Container>
  );
});

export default Home;
