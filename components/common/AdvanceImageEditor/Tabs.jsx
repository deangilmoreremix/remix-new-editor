/* eslint-disable react/prop-types */
/* eslint-disable no-sequences */
/* eslint-disable react/jsx-no-comment-textnodes */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState } from 'react';
import classnames from 'classnames';

import SVGInline from 'react-svg-inline';
import TabPane from './TabPane';


const Tabs = (props) => {
  const { children } = props;
  const { initialTab } = props;
  const [tabHeader, setTabHeader] = useState([]);
  const [tabHeaderObj, setTabHeaderObj] = useState([]);

  const [childContent, setChildContent] = useState({});
  const [active, setActive] = useState('');

  useEffect(() => {
    const headers = [];
    const headerObj = [];
    const childCnt = {};
    React.Children.forEach(children, (element) => {
      if (!React.isValidElement(element)) return;
      const { name } = element.props;

      const obj = {
        name: element.props.name,
        icon: element.props.icon,
      };
      headers.push(name);
      headerObj.push(obj);
      childCnt[name] = element.props.children;
    });
    setTabHeader(headers);
    setTabHeaderObj(headerObj);
    setChildContent({ ...childCnt });
  }, [props, children]);

  useEffect(() => {
    setActive(initialTab);
  }, []);


  const changeTab = (name) => {
    setActive(name);
  };

  return (
    <div className="tabs">
      <ul className="tab-header">
        {tabHeaderObj.map((item) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          // <li
          //   onClick={() => changeTab(item.name)}
          //   key={item}
          //   className={item === active ? 'active' : ''}
          // >
          //   <SVGInline
          //     className="svg-icon icon button-icon"
          //     svg={`${item.icon}`}
          //   />

          //   {item.name}
          // </li>
          <li key={item.name} className="tablist">
            <button onClick={() => changeTab(item.name)} className={`tabButton ${item === active ? 'active' : ''}`}>
              <SVGInline
                className="svg-icon icon button-icon"
                svg={`${item.icon}`}
              />
              {item.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="tab-content">
        {Object.keys(childContent).map((key) => {
          if (key === active) {
            return <div className="tab-child">{childContent[key]}</div>;
          } else {
            return null;
          }
        })}
      </div>
    </div>
  );
};

Tabs.propTypes = {
  children(props, propName, componentName) {
    const prop = props[propName];

    let error = null;
    React.Children.forEach(prop, (child) => {
      if (child.type !== TabPane) {
        error = new Error(
          `\`${componentName}\` children should be of type \`TabPane\`.`,
        );
      }
    });
    return error;
  },
};

export default Tabs;
