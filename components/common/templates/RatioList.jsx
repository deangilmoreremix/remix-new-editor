import React from 'react';
import PropTypes from '../../../lib/PropTypes';

import { CANVAS_SIZES } from '../../../lib/constants/media';
import Menu from '../Menu';

const SIZE_STRINGS = CANVAS_SIZES.map(item => ({
  title: `${item.width}/${item.height}`,
  value: { width: item.width, height: item.height },
}));

const listValues = [
  { title: 'All ratios' },
  ...SIZE_STRINGS,
];

const RatioList = ({ onChangeRatio }) => {
  const [activeElement, setActiveElement] = React.useState(listValues[0].title);

  const items = React.useMemo(() => listValues.filter(item => item.title !== activeElement),
    [activeElement]);

  const onClick = (value) => {
    const key = value ? `${value.width}/${value.height}` : listValues[0].title;
    setActiveElement(key);
    onChangeRatio(value);
  };

  return (
    <div>
      <Menu
        toggleElement={<span className="ratio-title">{activeElement}</span>}
        items={items}
        className="ratio"
        lineDropIcon
        needEndIcon
        onClick={onClick}
      />
    </div>
  );
};

RatioList.propTypes = {
  onChangeRatio: PropTypes.func.isRequired,
};

export default RatioList;
