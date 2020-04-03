import React, { Fragment } from 'react';

const withCloseButton = WrappedComponent => props => {
  const []

  return (
    <div className="close-block">
      <WrappedComponent {...props} />
      <button>click</button>
    </div>
  );
};

export default withCloseButton;