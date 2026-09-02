import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const Quotes = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getQuotes } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getQuotes}
      title="Quotes"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

Quotes.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Quotes;
