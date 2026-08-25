/* eslint-disable no-underscore-dangle */
/**
 * Created by Eugene Butusov on 28/11/2018.
 */
import Chroma from 'chroma-js';
import generateStyledCSS from './style-generators/styled-css-generator';
import generateSVGStyles from './style-generators/styled-svg-generator';

class WhiteLabelManager {
  _generateCSS() {
    if (!this.shouldOverride) {
      return '';
    }
    const { _whiteLabel: { _id, theme: { accent2Color: sourceColor = 'dimgray' }, domain }, _cdn: cdn } = this;
    const brandLogo = `${cdn}/wl/${domain}/resources/vc_logo`;
    const baseColor = Chroma(sourceColor);
    const theme = {
      primaryColor: baseColor.css(),
    };
    return `${generateStyledCSS(_id, brandLogo, theme)}${generateSVGStyles(_id, theme)}`;
  }

  constructor(whiteLabel, shouldOverride, cdn) {
    this._whiteLabel = whiteLabel || {};
    this._cdn = cdn;
    this.shouldOverride = shouldOverride;

    Object.assign(this, {
      key: this._whiteLabel._id,
      domain: this._whiteLabel.domain,
      serviceName: this._whiteLabel.name,
      brandName: `${this._whiteLabel.name} ${
        (this._whiteLabel.revolution && this._whiteLabel.revolution.alternateName)
          ? this._whiteLabel.revolution.alternateName
          : 'Revolution'
      }`,
      brandLogo: `${cdn}/wl/${this._whiteLabel.domain}/resources/vc_logo`,
      appName: (this._whiteLabel.go && this._whiteLabel.go.alternateName)
        ? this._whiteLabel.go.alternateName
        : 'GO',
      termsOfServiceLink: this._whiteLabel.termsOfServiceLink,
      tutorialsLink: this._whiteLabel.go && this._whiteLabel.go.tutorialsLink,
      css: this._generateCSS(),
    });
  }
}

export default WhiteLabelManager;
