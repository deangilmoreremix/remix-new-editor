import React, { Fragment } from 'react';
import { observer } from 'mobx-react';
import PropTypes from '../../../lib/PropTypes';

import useUserStore from '../../hooks/useUserStore';

const UserBox = observer(({ greeting }) => {
  const userStore = useUserStore();

  const { firstName, photo } = userStore;
  return (
    <Fragment>
      <div className="user-image-photo">
        <img className="userpic" src={photo} />
      </div>
      <div className="user-name">{`${greeting ? 'Hi, ' : ''}${firstName}`}</div>
    </Fragment>
  );
});

UserBox.propTypes = {
  greeting: PropTypes.bool,
};

UserBox.defaultProps = {
  greeting: true,
};

export default UserBox;
