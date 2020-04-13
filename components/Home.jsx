import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Col, Container, Row } from 'reactstrap';

import Canvas from './Canvas';
import Toolbar from './common/toolbar/Toolbar';

import useProjectStore from './hooks/useProjectStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';

import toolbarItems from '../lib/generators/toolbarItemsGenerator';
import Timeline from './Timeline';
import Library from './media/Library';

const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
  const projectStore = useProjectStore();
  const uiStore = useUIStore();
  const { openModal, closeModal } = useModalStore();
  const { isLoading } = projectStore;

  const { libraryType, setLibraryType } = uiStore;

  const asyncHero = useAsync(getOne, [projectStore, project]);

  if (asyncHero.loading || isLoading) {
    // todo implement loading
    return (<div>Loading</div>);
  }

  if (asyncHero.error) {
    // todo implement err message
    return (<div>Error</div>);
  }

  return (
    <Container fluid className="home">
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
            <Col xs={6} className="home__center">
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
