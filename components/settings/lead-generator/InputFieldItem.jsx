import React, { useEffect, useRef } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import FieldBuilder from '../../form/FieldBuilder';

import trashIcon from '../../../public/static/svgImages/common/trash.svg';
import burgerIcon from '../../../public/static/svgImages/common/burger.svg';

const InputFieldItem = observer(({ item, onRemove, fields, handleChangeInput }) => {
  const ref = useRef(null);

  const [inputValue, setInputValue] = React.useState(item.label || '');

  useEffect(() => {
    if (ref.current) {
      if (item.label === inputValue) {
        ref.current.focus();
      } else {
        ref.current.blur();
      }
    }
  }, [inputValue]);

  return (
    <div className="item-retarget-container lead-generator-container" key={item.id}>
      <SVGInline
        className="icon"
        classSuffix=""
        svg={burgerIcon}
        cleanup={['title']}
        alt="humburger"
      />
      <FieldBuilder
        type="input"
        ref={ref}
        value={inputValue}
        name={item.name}
        className="item-form"
        inputClassName="item-retarget-container-input"
        onChange={(v) => setInputValue(Object.values(v))}
        onBlur={() => handleChangeInput(inputValue, item.id)}
        onEnter={() => handleChangeInput(inputValue, item.id)}
      />
      <FieldBuilder
        value={item.value}
        {...fields.elements}
        onChange={(v) => handleChangeInput(v, item.id)}
      />
      <div className="flex-center retarget-remove">
        <SVGInline
          className="icon"
          classSuffix=""
          svg={trashIcon}
          cleanup={['title']}
          alt="Remove item"
          data-tip="Remove item"
        />
        <button onClick={() => onRemove(item.id)} className="icon icon-button svg-fix" type="button" />
      </div>
    </div>
  );
});


InputFieldItem.propTypes = {
  item: PropTypes.shape({}).isRequired,
  fields: PropTypes.shape({
    elements: PropTypes.shape({}),
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  handleChangeInput: PropTypes.func.isRequired,
};

export default InputFieldItem;
