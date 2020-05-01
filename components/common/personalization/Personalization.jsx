import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import { tokenModes, INPUT_PLACEHOLDER } from '../../../lib/constants/tokens';
import FormTextField from '../../form/FormTextField';

import svgCogWheel from '../../../public/static/images/cogwheel.svg';


const Personalization = ({ closeModal, tokenList }) => {
  const [token, setToken] = useState(tokenList[0]);
  const [tokenState, setTokenState] = useState(tokenModes.plain);
  const [disabled, setDisabled] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    setDisabled(tokenState !== tokenModes.fallbackValue);
  }, [tokenState]);

  useEffect(() => {
    if (!disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="personalization">
      <div className="personalization__wrapper">
        <div className="personalization__header">
          <p className="personalization__header__title">Personalizer</p>
          <button
            className="personalization__close"
            type="button"
            onClick={() => closeModal()}
          >
            X
          </button>
        </div>

        <div className="personalization__body">
          <div className={classnames('personalization__list', { personalization__list__border: tokenList.length > 9 })}>
            {
              tokenList.map((item) => (
                <div key={item} className="personalization__items">
                  <SVGInline
                    className={classnames('radio-button-icon', { personalization__svg__active: token === item })}
                    svg={svgCogWheel}
                    cleanup={['title']}
                  />
                  <button
                    type="button"
                    className={classnames('personalization__item', { 'personalization__item-active': token === item })}
                    onClick={() => setToken(item)}
                  >
                    {item}
                  </button>
                </div>
              ))
            }
          </div>

          <div className="personalization__info">
            <div>
              {
                tokenList.length > 1 ? <p className="personalization__name">{token}</p>
                  : (
                    <FormTextField
                      name="text"
                      inputClassName="personalization__input__image"
                      type="input"
                      value={token}
                      onChange={(v) => setToken(v)}
                    />
                  )
              }
              <div className="personalization__item__right">
                {
                  Object.keys(tokenModes).map((item) => (
                    <div
                      key={tokenModes[item]}
                      className={classnames('personalization__item__container', { 'item-fallback': item === 'fallbackValue' })}
                    >
                      <button
                        type="button"
                        className={classnames('personalization__item', { 'personalization__item-active': tokenState === tokenModes[item] })}
                        onClick={() => setTokenState(tokenModes[item])}
                      >
                        {tokenModes[item]}
                      </button>
                      {item === 'fallbackValue'
                      && (
                        <input
                          className="personalization__input"
                          type="text"
                          disabled={disabled}
                          ref={inputRef}
                          placeholder={INPUT_PLACEHOLDER}
                        />
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
            <button className="personalization__add" type="button">+ add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

Personalization.propTypes = {
  closeModal: PropTypes.func.isRequired,
  tokenList: PropTypes.arrayOf(PropTypes.string),
};

export default Personalization;
