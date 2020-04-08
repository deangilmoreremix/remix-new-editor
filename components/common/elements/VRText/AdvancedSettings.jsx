import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import GoogleFontsLoader from '../../../../components/wizard/editor/GoogleFontsLoader';
import fonts from '../../../../lib/constants/fonts';
import FormSelect from '../../../form/FormSelect';
import FormSlider from '../../../form/FormSlider';
import FormColor from "../../../form/FormColor";
import FormCheckboxField from '../../../form/FormCheckboxField';

import svgTextAlignLeft from '../../../../public/static/images/text/text-align-left.svg';
import svgTextAlignCenter from '../../../../public/static/images/text/text-align-center.svg';
import svgTextAlignRight from '../../../../public/static/images/text/text-align-right.svg';
import svgTextLineHeight from '../../../../public/static/images/text/line-height.svg';
import svgTextLetterSpacing from '../../../../public/static/images/text/letter-spacing.svg';
import svgArrowBottom from '../../../../public/static/images/text/arrow-bottom.svg';

const fontStyle = ['Italic', 'Regular', 'Bold'];

const AdvancedSettings = () => {
  const [fontFamilyValue, setFontFamilyValue] = useState(fonts[0]);
  const [fontStyleValue, setFontStyleValue] = useState(fontStyle[0]);
  const [sliderValue, setSliderValue] = useState(0);
  const [otherOption, setOtherOption] = useState(false);

  // const switchInputToSetValue = {
  //   inputFontName: setInputFontValue,
  //   inputFontStyleValue: setInputFontStyleValue,
  // };
  const selectFontChange = (value) => {
    setFontFamilyValue(value);
  };
  const selectFontStyleChange = (value) => {
    setFontStyleValue(value);
  };
  const sliderHandleChange = (value) => {
    setSliderValue(value);
  };

  return (
    <Fragment>
      <div>
        <GoogleFontsLoader fonts={fonts} />
        <div className="container-font">
          <FormSelect
            label="Font"
            componentClasses={{
              containerClass: 'container-font-list',
              labelClass: 'container-font-label',
              selectClass: 'container-font-select',
              itemClass: 'container-font-item',
            }}
            items={fonts}
            onChange={selectFontChange}
            value={fontFamilyValue}
          />
          <FormSlider
            componentClasses={{
              containerClass: 'container-font-slider',
              sliderClass: 'container-font-slider-element',
              inputClass: 'container-font-slider-input',
            }}
            sliderWidth={300}
            value={sliderValue}
            onChange={sliderHandleChange}
          />
        </div>
        <div className="container-font">
          <FormSelect
            labelWidth={0}
            componentClasses={{
              containerClass: 'container-font-list',
              labelClass: 'container-font-label',
              selectClass: 'container-font-select',
              itemClass: 'container-font-item',
            }}
            items={fontStyle}
            onChange={selectFontStyleChange}
            value={fontStyleValue}
          />
          <div className="container-text-edit">
            <SVGInline
              className="icon-text"
              classSuffix="-inline"
              svg={svgTextAlignLeft}
              cleanup={['title']}
            />
            <SVGInline
              className="icon-text"
              classSuffix="-inline"
              svg={svgTextAlignCenter}
              cleanup={['title']}
            />
            <SVGInline
              className="icon-text"
              classSuffix="-inline"
              svg={svgTextAlignRight}
              cleanup={['title']}
            />
            <SVGInline
              className="icon-text"
              classSuffix="-inline"
              svg={svgTextLineHeight}
              cleanup={['title']}
            />
            <span>Auto</span>
            <SVGInline
              className="icon-text"
              classSuffix="-inline"
              svg={svgTextLetterSpacing}
              cleanup={['title']}
            />
          </div>
        </div>
        <div className="container-form-checkbox">
          <div className="container-font">
            <FormColor />
            <FormCheckboxField label="Shadow" />
            <FormCheckboxField label="Outline" />
          </div>
          <FormCheckboxField
            floatClassName="checbox-background"
            label="Background"
          />
        </div>
        <div className="container-icon-arrow" onClick={() => setOtherOption(!otherOption)}>
          <SVGInline
            className={classnames('icon-arrow', { 'icon-arrow-rotate': otherOption })}
            classSuffix="-inline"
            svg={svgArrowBottom}
            cleanup={['title']}
          />
        </div>
        {otherOption && (
          <div className="additional-settings">
            <FormColor label="Shadow color" />
            <FormColor label="Outline color" />
            <FormColor label="Fill color" />
            <FormCheckboxField label="Scale to fit" />
          </div>
        )}
      </div>

    </Fragment>
  );
};

export default AdvancedSettings;
