import * as React from 'react';
import { Col, Container, Row } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const ElementsPanel = ({ items }) => (
  <Container className="elements-panel-container">
    <Row className="elements-panel-inner-row">
      {items.map(({ label, icon, action, visible, disabled }) => {
        if (!visible) return null;

        return (
          <Col
            xs={4}
            key={label}
            tag="button"
            className="elements-panel-button"
            disabled={disabled}
            onClick={action}
            type="button"
          >
            <SVGInline
              className="elements-panel-icon"
              classSuffix="-inline"
              svg={icon}
              cleanup={['title']}
            />
            <span className="elements-panel-label">{label}</span>
          </Col>
        );
      })}
    </Row>
  </Container>
);

ElementsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    icon: PropTypes.string,
    action: PropTypes.func,
    visible: PropTypes.boolean,
    disabled: PropTypes.boolean,
  })).isRequired,
};

export default ElementsPanel;
