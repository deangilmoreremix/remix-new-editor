import React from 'react';
import { Button, Container, Row, Col } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';
import ElementsPanel from '../toolbar/ElementsPanel';
import SVGTrash from '../../../public/static/svgImages/common/trash.svg';

// todo implement it
const Layer = observer(({ item }) => (
  <Row className="layer">
    <Col md={1} className="without-padding">
      <SVGInline
        className="icon"
        classSuffix=""
        svg={SVGTrash}
        cleanup={['title']}
        alt="Remove Element"
        data-tip="Remove text element"
      />
    </Col>
    <Col md={3} className="without-padding">
      <span className="title">
        {item.name || item.defaultName}
      </span>
    </Col>
    <Col md={1} className="without-padding">
      <Button>edit</Button>
    </Col>
    <Col md={3} className="without-padding">
      <Button>Normal</Button>
    </Col>
    <Col md={1} className="without-padding">
      <Button>100%</Button>
    </Col>
    <Col md={1} className="without-padding">
      <Button>0</Button>
    </Col>
    <Col md={1} className="without-padding">
      <Button>0</Button>
    </Col>
  </Row>
),
);

Layer.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
  }).isRequired,
};

export default Layer;
