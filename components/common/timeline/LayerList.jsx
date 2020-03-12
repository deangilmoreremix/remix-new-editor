import React from 'react';
import { Button, Container } from 'reactstrap';

import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';
import ElementsPanel from '../toolbar/ElementsPanel';

// todo implement it
const Layer = observer(({ item }) => (
  <Container>
    <div className="layer">
      <Button>X</Button>
      <span className="title">
        {item.name}
      </span>
      <Button>edit</Button>
      <Button>more</Button>
    </div>
  </Container>
),
);

Layer.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
  }).isRequired,
};

export default Layer;
