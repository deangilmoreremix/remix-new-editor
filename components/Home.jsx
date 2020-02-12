import React, { Component } from 'react';
import { Col, Container, Row } from 'react-bootstrap';

import Toolbar from './common/Toolbar/Toolbar';
import toolbarItems from '../lib/generators/toolbarItemsGenerator';

class Home extends Component {
  debugger;

  render() {
    return (
      <Container fluid className="home">
        <Row>
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
      </Container>
    );
  }
}

export default Home;
