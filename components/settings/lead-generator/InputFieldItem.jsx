import React, { useEffect, useRef, useState } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import trashIcon from '../../../public/static/svgImages/common/trash.svg';
import burgerIcon from '../../../public/static/svgImages/common/burger.svg';
import FieldBuilder from '../../form/FieldBuilder';

const InputFieldItem = observer(({ item, onRemove, fields, handleChangeInput }) => {
  const ref = useRef(null);

  const [inputValue, setInputValue] = React.useState(item.label || '');
  const [isEdit, setIsEdit] = useState(false);


  useEffect(() => {
    if (ref.current) {
      if (isEdit) {
        ref.current.focus();
      } else {
        ref.current.blur();
      }
    }
  }, [isEdit]);

  const onEdit = (v) => {
    setIsEdit(!isEdit);
    setInputValue(Object.values(v));
  };

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
        onChange={(v) => onEdit(v)}
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
  item: PropTypes.shape({}),
};

export default InputFieldItem;
