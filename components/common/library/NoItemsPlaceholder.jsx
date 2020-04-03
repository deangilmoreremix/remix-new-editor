import React, { Fragment } from 'react';
import PropTypes from '../../../lib/PropTypes';

const NoItemsPlaceholder = ({ isUserItems }) => (
  <Fragment>
    {isUserItems && <div className="library__item" />}
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
    <div className="library__item" />
  </Fragment>
);

NoItemsPlaceholder.propTypes = {
  isUserItems: PropTypes.bool.isRequired,
};

export default NoItemsPlaceholder;
