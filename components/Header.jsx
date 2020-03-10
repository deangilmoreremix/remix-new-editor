import React from 'react';
import { Container } from 'reactstrap';

import Menu from './Menu';

const Header = (props) => (
  <Container>
    <header className="header-container">
      <Menu {...props} />
    </header>
  </Container>
);

export default Header;
