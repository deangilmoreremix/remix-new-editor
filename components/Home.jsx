import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Col, Container, Row } from 'reactstrap';

import Header from './Header';
import Canvas from './Canvas';
import Toolbar from './common/toolbar/Toolbar';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUI from './hooks/useUIStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import Timeline from './Timeline';
import Library from './media/Library';

const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
  const projectStore = useProjectStore();
  const uiStore = useUI();
  const { openModal, closeModal } = useModalStore();

  const { libraryType, setLibraryType } = uiStore;

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
              <Toolbar
                items={toolbarItems({
                  actions: {
                    openModal,
                    closeModal,
                    setLibraryType,
                  },
                })}
              />
            </Col>
            <Col xs={6}>
              {libraryType && <Library tab={libraryType} />}
            </Col>
          </Row>
        </Col>
        <Col xs={5}>
          <Canvas />
        </Col>
      </Row>
      <Row className="timeline" noGutters>
        <Timeline />
      </Row>
    </Container>
  );
});

export default Home;
