import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Col, Container, Row } from 'reactstrap';

import Header from './Header';
import Toolbar from './common/toolbar/Toolbar';
import useProjectStore from './hooks/useProjectStore';
import toolbarItems from '../lib/generators/toolbarItemsGenerator';
import useModalStore from './hooks/useModalStore';


const getOne = async (store, id) => {
  await store.getOne(id);
};

const Home = observer(() => {
  const { query: { project } } = useRouter();
  const projectStore = useProjectStore();
  const modalStore = useModalStore();
  const asyncHero = useAsync(getOne, [projectStore, project]);

  if (asyncHero.loading) {
    // todo implement loading
    return (<div>Loading</div>);
  }

  if (asyncHero.error) {
    // todo implement err message
    return (<div>Error</div>);
  }

  const { openModal, closeModal } = modalStore || {};

  return (
    <Container fluid className="home">
      <Header />
      <Row className="controls" noGutters>
        <Col xs={4}>
          <Toolbar items={toolbarItems({ actions: { openModal, closeModal } })} />
        </Col>
        <Col xs={4}>
          Hi!
        </Col>
        <Col xs={4}>
          Hi again!
        </Col>
      </Row>
      <Row className="timeline" noGutters />
    </Container>
  );
});

export default Home;
