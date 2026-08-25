import * as React from 'react';

const Loader = () => (
  <div className="loading-iframe">
    <div className="loader">
      <div className="loader-inner loader-one" />
      <div className="loader-inner loader-two" />
      <div className="loader-inner loader-three" />
    </div>
  </div>
);

export default React.memo(Loader);
