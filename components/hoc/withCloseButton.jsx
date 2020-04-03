import React, { Fragment } from 'react';

const withCloseButton = WrappedComponent => props => {
  return (
    <Fragment>
      <WrappedComponent {...props} close={hide} openModal={show} />
    </Fragment>
  );
};

export default withCloseButton;