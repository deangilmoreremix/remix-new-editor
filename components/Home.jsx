import React from 'react';
import { observer } from 'mobx-react';
import { useRouter } from 'next/router';
import { useAsync } from 'react-async-hook';
import { Col, Container, Row } from 'reactstrap';

import Toolbar from './common/toolbar/Toolbar';
import useProjectStore from './hooks/useProjectStore';
import toolbarItems from '../lib/generators/toolbarItemsGenerator';

import 'styles/index.scss';

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
    <Container fluid>
      <Row className="controls" noGutters>
        <Col xs={4}>
          <Toolbar items={toolbarItems} />
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
