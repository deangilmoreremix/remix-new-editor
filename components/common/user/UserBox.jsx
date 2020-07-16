import React, { Fragment } from 'react';

import useUserStore from '../../hooks/useUserStore';

const UserBox = () => {
  const userStore = useUserStore();

  const { firstName, photo } = userStore;
  return (
    <Fragment>
      <div>
        <img className="userpic" src={photo} />
      </div>
      <div>{`Hi, ${firstName}`}</div>
    </Fragment>
  );
};

export default UserBox;
