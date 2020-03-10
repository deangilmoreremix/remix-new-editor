import React, { Fragment, useState } from 'react';
import { observer } from 'mobx-react';

import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';

import NavbarHamburger from './common/navbar/NavbarHamburger';
import useProjectStore from './hooks/useProjectStore';

const Menu = observer(() => {
  const currentUser = { fullName: 'Alexei', avatar: 'blablaba' }; // TODO example
  const whiteLabelManager = { domain: 'videoremix.io' }; // TODO EXAMPLE

  const [isOpen, setIsOpen] = useState(false);
  const { save, activeProject } = useProjectStore();

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  const saveProject = async () => {
    await save(activeProject);
  };

  return (
    <Fragment>
      <Navbar color="faded" light expand="md">
        <NavbarHamburger />
          BrandLogo
        <NavbarBrand href="/" />
        <div className="container-page-nav">
          <div className="container-page-nav-undo">
            <img src="#" alt="" />
            <span>undo</span>
          </div>
          <div className="container-page-nav-redo">
            <img src="#" alt="" />
            <span>redo</span>
          </div>
          <div className="container-page-nav-save">
            <img src="#" alt="" />
            <button onClick={saveProject}>save</button>
          </div>
        </div>
        <NavbarToggler onClick={toggle} />
        <Collapse isOpen={isOpen} navbar>
          <Nav className="ml-auto" navbar>
            <div className="language-container">
              <span className="language-picker">
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#" className="language-link">English (US)</a>
                <div className="list-of-languages" />
              </span>
            </div>
            <UncontrolledDropdown nav>
              <div className="group-bordered">
                <DropdownToggle nav caret>
                  <img src="#" alt="" className="avatar" />
                    Hi
                  {' '}
                  { currentUser.fullName }
                </DropdownToggle>
                <DropdownMenu>
                  <DropdownItem>
                    <img className="icon-menu folder" src="" alt="" />
                    <a href="#/item">
                      {whiteLabelManager.domain === 'videoremix.io' ? 'My projects' : 'Projects'}
                    </a>
                  </DropdownItem>
                  <DropdownItem>
                    <img className="icon-menu sign-out" src="" alt="" />
                    <a href="#/settings">
                        Sign out
                    </a>
                  </DropdownItem>
                  <DropdownItem>
                    <img className="icon-menu collaborate" src="" alt="" />
                    <a
                        // onClick={e => this.logoutHandler(e)}
                      onContextMenu={e => e.preventDefault()}
                    >
                        Collaborate
                    </a>
                  </DropdownItem>
                </DropdownMenu>
              </div>
            </UncontrolledDropdown>
          </Nav>
        </Collapse>
      </Navbar>
    </Fragment>
  );
});


export default Menu;
