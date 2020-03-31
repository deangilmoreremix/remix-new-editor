import React from 'react';

export const LoaderCircle = () => (
  <div className="loader">
    <div className="lds-ring">
      <div />
      <div />
      <div />
      <div />
    </div>
  </div>
);

export const LibrarySpinner = () => (
  <div className="loader">
    <div className="lds-ellipsis">
      <div />
      <div />
      <div />
      <div />
    </div>
  </div>
);