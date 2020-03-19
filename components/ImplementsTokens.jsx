import React, {useState, useRef} from "react";
import classnames from 'classnames';

const systemDefaults = [
    'firstname',
    'lastname',
    'email',
    'geocountry',
    'geocity',
    'geostate',
    'name',
    'gender',
    'custom'
];

const radioBtns = ['Plain', 'Fallback value:', 'UPPERCASE'];

const ImplementsToken = () => {
    const [listItem, setListItem] = useState(systemDefaults[0]);
    const [radio, setRadio] = useState(radioBtns[0]);
    const [activeInput, setActiveInput] = useState(true);
    const inputRef = useRef(null);

    const handleChangeRadio = value => async () => {
        setRadio(value);
        if (value === radioBtns[1]) {
            await setActiveInput(false);
            await inputRef.current.focus();
        } else {
            setActiveInput(true);
        }
    };

    const handleChangeListItem = value => () => setListItem(value);

    const onInputFocus = () => handleChangeRadio(radioBtns[1]);

    return (
        <div className="implements">
            <div className="implements__wrapper">
                <div className="implements__header">
                    <p>Personalizer</p>
                    <button className='implements__close'>X</button>
                </div>

                <div className="implements__body">
                    <ul className="implements__list">
                        {
                            systemDefaults.map(item => (
                                <li
                                    className={classnames('implements__item', {'implements__item-active': listItem === item})}
                                    key={item}
                                    onClick={handleChangeListItem(item)}
                                >
                                    {item}
                                </li>
                            ))
                        }
                    </ul>

                    <div className="implements__info">
                        <div>
                            <p className="implements__name">{listItem || ''}</p>
                            <ul>
                                {
                                    radioBtns.map(item => (
                                        <li
                                            className={classnames('implements__item', {'implements__item-active': radio === item})}
                                            key={item}
                                            onClick={handleChangeRadio(item)}
                                        >
                                            {item}
                                        </li>
                                    ))
                                }
                            </ul>
                            <div className='implements__block-input' onClick={onInputFocus}>
                                <input className="implements__input" type="text" disabled={activeInput} ref={inputRef} />
                            </div>
                        </div>
                        <button className='implements__add'>add</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImplementsToken;