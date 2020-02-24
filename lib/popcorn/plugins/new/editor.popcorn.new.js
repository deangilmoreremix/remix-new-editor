import React from 'react';
import SVGInline from 'react-svg-inline';
import ReactTooltip from 'react-tooltip';
import { observer, inject } from 'mobx-react';

import Project from '../../../editor/Project';
import PopcornEditor from '../editor.popcorn';
import PropTypes from '../../../PropTypes';

import SVGNewText from '../../../../static/images/editor/elements/new/new_text.svg';
import SVGNewImage from '../../../../static/images/editor/elements/new/new_image.svg';
import SVGNewLeadGenerator from '../../../../static/images/editor/elements/new/new_lead_generator.svg';
import SVGNewPersonalizedImage from '../../../../static/images/editor/elements/new/new_personalized.svg';

import SVGPauseOnCtaEnabled from '../../../../static/images/editor/elements/common/pause_on_cta-enabled.svg';
import SVGPauseOnCtaDisabled from '../../../../static/images/editor/elements/common/pause_on_cta-disabled.svg';

import SVGLoopEnabled from '../../../../static/images/editor/elements/common/loop-enabled.svg';
import SVGLoopDisabled from '../../../../static/images/editor/elements/common/loop-disabled.svg';

import SVGFacebookEnabled from '../../../../static/images/editor/elements/common/use_facebook-enabled.svg';
import SVGFacebookDisabled from '../../../../static/images/editor/elements/common/use_facebook-disabled.svg';

import SVGLinkedinEnabled from '../../../../static/images/editor/elements/common/use_linkedin-enabled.svg';
import SVGLinkedinDisabled from '../../../../static/images/editor/elements/common/use_linkedin-disabled.svg';

const callToActionFeature = {
  enabled: 'https://example.com or +12345678900, +1-(234)-567-89-00, 1234456565, +1-234-567-89-00',
  disabled: 'https://example.com',
};

@inject('store')
@observer
export default class NewElementBar extends PopcornEditor {
  static propTypes = {
    project: PropTypes.instanceOf(Project).isRequired,
    defaultImage: PropTypes.string,
    checkForm: PropTypes.func,
    features: PropTypes.any, // TODO: define prop type
  };

  addElement(type, options) {
    const { project, checkForm } = this.props;
    if (type === 'form' && project.elements.some(item => item.type === type)) {
      alert('You can only have one lead generator in your video, please edit the lead generator you added previously.');
      return;
    }
    const currentCheckpointIndex = project.currentCheckpoint
      ? project.checkpoints.indexOf(project.currentCheckpoint)
      : 0;
    let elementDuration = project.elements
      .find(({ type: elementType, popcornOptions }) => Math.round(popcornOptions.start * 100)
        / 100 === project.currentCheckpoint
        && Project.EditableElementTypes.indexOf(elementType) !== -1,
      );
    if (elementDuration) {
      elementDuration = elementDuration.popcornOptions.end;
    } else {
      elementDuration = project.checkpoints[currentCheckpointIndex + 1]
        ? project.checkpoints[currentCheckpointIndex]
        + ((project.checkpoints[currentCheckpointIndex + 1]
          - project.checkpoints[currentCheckpointIndex]) * 0.7)
        : project.projectData.media[0].duration;
    }
    Object.assign(options, {
      start: project.checkpoints[currentCheckpointIndex],
      end: elementDuration,
      target: 'video-container',
    });
    project.add({ type, popcornOptions: options });
    checkForm();
  }

  render() {
    const { project, defaultImage, features, store, store: { common: { features: featureConsts } } } = this.props;
    return (
      <div className="popcorn-editor new-bar">
        <ReactTooltip
          effect="solid"
        />
        <button
          className="action-button"
          onClick={() => this.addElement('text', {
            text: 'Put your text here',
            linkUrl: callToActionFeature[features.clickToPhoneCall.state],
            linkTarget: '_blank',
            position: 'custom',
            alignment: 'center',
            transition: 'popcorn-fade-in',
            rotation: 0,
            fontFamily: 'Anton',
            fontSize: 8,
            fontColor: '#ffffff',
            shadow: false,
            shadowColor: '#444444',
            background: false,
            stroke: false,
            strokeColor: '#000000',
            fontDecorations: {
              bold: false,
              italics: false,
              responsive: true,
            },
            left: 20,
            top: 20,
            width: 40,
            height: 40,
            zindex: 1000,
          })}
          data-tip="Add new text element"
        >
          <SVGInline className="icon new-text-icon" classSuffix="" svg={SVGNewText} cleanup={['title']} />
        </button>
        <button
          className="action-button"
          onClick={() => this.addElement('image', {
            src: defaultImage || 'https://cdn.vidcloud.io/resources/go/static/images/logo.svg',
            linkSrc: callToActionFeature[features.clickToPhoneCall.state],
            width: 33,
            height: 33,
            top: 35,
            left: 35,
            innerTop: 0,
            innerLeft: 0,
            innerWidth: 100,
            innerHeight: 100,
            title: 'Image',
            transition: 'popcorn-fade',
            rotation: 0,
            zindex: 1000,
          })}
          data-tip="Add new image element"
        >
          <SVGInline className="icon new-image-icon" classSuffix="" svg={SVGNewImage} cleanup={['title']} />
        </button>
        <button
          className="action-button"
          onClick={() => this.addElement('personalizedImage', {
            src: '{{IMAGE}}',
            width: 33,
            height: 33,
            top: 35,
            left: 35,
            innerTop: 0,
            innerLeft: 0,
            innerWidth: 100,
            innerHeight: 100,
            title: '',
            transition: 'popcorn-fade',
            rotation: 0,
            zindex: 1000,
          })}
          data-tip="Add new personalized image element"
        >
          <SVGInline
            className="icon new-personalized-icon"
            classSuffix=""
            svg={SVGNewPersonalizedImage}
            cleanup={['title']}
          />
        </button>
        { (store.isAdmin() ||
          (
            features[featureConsts.leadgen] &&
            features[featureConsts.leadgen].state === 'enabled')
        )
          && (
          <button
            className="action-button"
            onClick={() => this.addElement('form', {
              innerTop: 0,
              innerLeft: 0,
              transition: 'popcorn-fade-in',
              fontColor: '#ffffff',
              backgroundColor: '#000000',
              privacyDisclaimer: 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.',
              elements:
              [{
                type: 'email',
                label: 'Email',
                token: 'EMAIL',
              }],
            })}
            data-tip="Add new lead generator element"
          >
            <SVGInline
              className="icon new-personalized-icon"
              classSuffix=""
              svg={SVGNewLeadGenerator}
              cleanup={['title']}
            />
          </button>
          )
        }
        <div className="separator" />
        <div className="separator" />
        <button
          className="action-button"
          onClick={() => {
            project.stopOnCta = !project.stopOnCta;
          }}
          data-tip={`Pause at the end of the video option is ${project.stopOnCta ? 'enabled' : 'disabled'}`}
        >
          <SVGInline
            className={`icon pause-cta-${project.stopOnCta ? 'enabled' : 'disabled'}-icon`}
            classSuffix=""
            svg={project.stopOnCta ? SVGPauseOnCtaEnabled : SVGPauseOnCtaDisabled}
            cleanup={['title']}
          />
        </button>
        <button
          className="action-button"
          onClick={() => {
            project.loop = !project.loop;
          }}
          data-tip={`Loop this video option is ${project.loop ? 'enabled' : 'disabled'}`}
        >
          <SVGInline
            className={`icon loop-${project.loop ? 'enabled' : 'disabled'}-icon`}
            classSuffix=""
            svg={project.loop ? SVGLoopEnabled : SVGLoopDisabled}
            cleanup={['title']}
          />
        </button>
        {(features.socializer && features.socializer.state === 'enabled')
        && (
        <button
          className="action-button"
          onClick={() => {
            if (project.allowedSocials.indexOf('facebook') !== -1) {
              project.allowedSocials.splice(project.allowedSocials.indexOf('facebook'), 1);
            } else {
              project.allowedSocials.push('facebook');
            }
          }}
          data-tip={`Allow Facebook option is ${project.allowedSocials.indexOf('facebook') !== -1 ? 'enabled' : 'disabled'}`}
        >
          <SVGInline
            className={`icon facebook-${project.allowedSocials.indexOf('facebook') !== -1 ? 'enabled' : 'disabled'}-icon`}
            classSuffix=""
            svg={project.allowedSocials.indexOf('facebook') !== -1 ? SVGFacebookEnabled : SVGFacebookDisabled}
            cleanup={['title']}
          />
        </button>
        )
        }
        {(features.linked && features.linked.state === 'enabled')
        && (
        <button
          className="action-button"
          onClick={() => {
            if (project.allowedSocials.indexOf('linkedin') !== -1) {
              project.allowedSocials.splice(project.allowedSocials.indexOf('linkedin'), 1);
            } else {
              project.allowedSocials.push('linkedin');
            }
          }}
          data-tip={`Allow LinkedIn option is ${project.allowedSocials.indexOf('linkedin') !== -1 ? 'enabled' : 'disabled'}`}
        >
          <SVGInline
            className={`icon linkedin-${project.allowedSocials.indexOf('linkedin') !== -1 ? 'enabled' : 'disabled'}-icon`}
            classSuffix=""
            svg={project.allowedSocials.indexOf('linkedin') !== -1 ? SVGLinkedinEnabled : SVGLinkedinDisabled}
            cleanup={['title']}
          />
        </button>
        )
        }
      </div>
    );
  }
}
