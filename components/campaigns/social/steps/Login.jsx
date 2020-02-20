import React, { Fragment } from 'react';
import { Button } from 'reactstrap';

import PropTypes from '../../../../lib/PropTypes';
import ProjectPropType from '../../../../lib/prop-types/ProjectPropType';


const Login = ({ project, onLogin, className }) => (
  <Fragment>
    <div className={className || ''}>
      <div className="project-container">
        <div className="tile" style={{ backgroundImage: `url(${project.cover})` }} />
        <p className="project-name">{project.title}</p>
      </div>
      <div className="login-container">
        <p className="login-title">You must login to social network and authorize our app to post videos</p>
        <Button onClick={onLogin}>Login</Button>
        <p className="hint">
          Note: Please do not use our app in private browsing mode or with an Ad Blocker/Js/
          Popup blocking browser extension
        </p>
      </div>
    </div>
  </Fragment>
);

Login.propTypes = {
  project: ProjectPropType.isRequired,
  onLogin: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default Login;
