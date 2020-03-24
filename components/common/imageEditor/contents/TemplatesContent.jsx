import React from 'react';

const Templates = () => {
  return (
    <div className="panel-content">
      <div className="panel-content__row">
        <p className="panel-content__title">Recently Used</p>
        <button type="button" className="panel-content__button">See all</button>
      </div>

      <div className="panel-content__row">
        <button className="panel-content__img"></button>
      </div>
    </div>
  );
};

export default Templates;