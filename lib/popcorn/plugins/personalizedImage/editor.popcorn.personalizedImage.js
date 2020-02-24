import React from 'react';
import { observer } from 'mobx-react';
import ReactTooltip from 'react-tooltip';
import { ChromePicker } from 'react-color';
import SVGInline from 'react-svg-inline';

import PopcornEditor from '../editor.popcorn';

import SVGTrash from '../../../../static/images/editor/elements/new/clear.svg';

import SVGFillBackground from '../../../../static/images/editor/elements/image/background.svg';
import SVGSquareBackground from '../../../../static/images/editor/elements/image/square.svg';
import SVGCircleBackground from '../../../../static/images/editor/elements/image/circle.svg';
import SVGNoBackground from '../../../../static/images/editor/elements/image/no_background.svg';
import SVGZoomIn from '../../../../static/images/editor/elements/image/zoom_in.svg';
import SVGZoomOut from '../../../../static/images/editor/elements/image/zoom_out.svg';

@observer
export default class PersonalizedImageEditor extends PopcornEditor {
  state = {
    showColorPicker: false,
  };

  render() {
    const { element } = this.props;
    return (
      <div className="popcorn-editor image-editor personalized-image-editor">
        <ReactTooltip
          effect="solid"
        />
        <div className="icon-group background">
          <SVGInline
            className="icon background-square-icon"
            classSuffix=""
            svg={SVGSquareBackground}
            cleanup={['title']}
            alt="Square Background"
            onClick={() => this.updateElement('cornerRadius', 0)}
            data-tip="Square background"
          />
          <SVGInline
            className="icon no-background-icon"
            classSuffix=""
            svg={SVGNoBackground}
            cleanup={['title']}
            alt="No Background"
            onClick={() => this.updateElement('background', false)}
            data-tip="Reset background color"
          />
          <SVGInline
            className="icon background-circle-icon"
            classSuffix=""
            svg={SVGCircleBackground}
            cleanup={['title']}
            alt="Circle Background"
            onClick={() => this.updateElement('cornerRadius', 50)}
            data-tip="Circle background"
          />
        </div>
        <div className="separator" />
        <div className="zoomer">
          <SVGInline
            className="icon zoom-out-icon"
            classSuffix=""
            svg={SVGZoomOut}
            cleanup={['title']}
            alt="Zoom Out"
            onClick={() => this.updateMultiple({
              innerWidth: Math.max(element.innerWidth - 5, 50),
              innerHeight: Math.max(element.innerWidth - 5, 50),
              innerTop: (100 - Math.max(element.innerWidth - 5, 50)) / 2,
              innerLeft: (100 - Math.max(element.innerWidth - 5, 50)) / 2,
            })}
            data-tip="Zoom out"
          />
          <input
            className="slider"
            type="range"
            min={50}
            max={200}
            step={1}
            value={element.innerWidth}
            onChange={({ target: { value } }) => this.updateMultiple({
              innerWidth: +value,
              innerHeight: +value,
              innerTop: (100 - value) / 2,
              innerLeft: (100 - value) / 2,
            })}
          />
          <SVGInline
            className="icon zoom-in-icon"
            classSuffix=""
            svg={SVGZoomIn}
            cleanup={['title']}
            alt="Zoom In"
            onClick={() => this.updateMultiple({
              innerWidth: Math.min(element.innerWidth + 5, 200),
              innerHeight: Math.min(element.innerWidth + 5, 200),
              innerTop: (100 - Math.min(element.innerWidth + 5, 200)) / 2,
              innerLeft: (100 - Math.min(element.innerWidth + 5, 200)) / 2,
            })}
            data-tip="Zoom in"
          />
        </div>
        <div className="separator" />
        <div>
          <div className="color-picker-button-container">
            <SVGInline
              className="icon background-fill-icon"
              classSuffix=""
              svg={SVGFillBackground}
              cleanup={['title']}
              alt="Background Color"
              onClick={() => this.setState({
                showColorPicker: !this.state.showColorPicker,
              })}
              data-tip="Background color"
            />
          </div>
          { this.state.showColorPicker ?
            <div className="color-picker">
              <div
                className="color-picker-inner"
                onClick={() => this.setState({ showColorPicker: false })}
              />
              <ChromePicker
                color={this.parseRgba(element.backgroundColor)}
                onChangeComplete={color => this.updateMultiple({
                  background: true,
                  backgroundColor: `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`,
                })}
              />
            </div> : null }
        </div>
        <div className="separator" />
        <div className="separator" />
        <div>
          <SVGInline
            className="icon clear-icon"
            classSuffix=""
            svg={SVGTrash}
            cleanup={['title']}
            alt="Remove Element"
            onClick={() => this.removeElement()}
            data-tip="Remove personalized image element"
          />
        </div>
      </div>
    );
  }
}

PopcornEditor.editors.personalizedImage = PersonalizedImageEditor;
