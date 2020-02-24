import React, { Component } from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const iframeStyling = `<!--- embed styling ---->
<style> 
  .iframe-container { position:relative; padding-bottom:56.25%; padding-top:30px; height:0; overflow:hidden; border:1px solid #ccc; }
  .iframe-container iframe,.iframe-container object,.iframe-container embed { position:absolute; top:0; left:0; width:100%; height:100%; }
</style>
<!--- End of embed styling ---->
`;

const defaultStringGenerator = (url, width, height) => (`${iframeStyling}\r<iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe>\r<script>var vars={};var tempstring='';var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value){if(value){tempstring+=key+'='+value+'&';}});if (tempstring) { if (document.getElementById('vr-${url.split('/').reverse()[0]}')) {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);} else {document.addEventListener('DOMContentLoaded',function() {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);});}}</script>`);

class EmbedDataContainer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      width: 560,
      height: 358,
    };
  }

  render() {
    const {
      url,
      className,
      resizable = false,
      stringGenerator = defaultStringGenerator,
    } = this.props;
    const { height, width } = this.state;

    return (
      <>
        <div className={className}>
          <div className={resizable ? 'resizer' : 'hidden'}>
            <span>Size</span>
            <span style={{ float: 'right' }}>
              <Input
                className="dimension-input"
                type="text"
                value={height}
                onChange={({ target: { value } }) => this.setState({ height: value })}
              />
              <span>X</span>
              <Input
                className="dimension-input"
                type="text"
                value={width}
                onChange={({ target: { value } }) => this.setState({ width: value })}
              />
            </span>
          </div>
          <Input
            type="textarea"
            readOnly
            rows={4}
            value={stringGenerator(url, width, height)}
            onClick={({ target }) => { target.select(); }}
          />
        </div>
      </>
    );
  }
}

EmbedDataContainer.propTypes = {
  className: PropTypes.string,
  url: PropTypes.string.isRequired,
  resizable: PropTypes.bool,
  stringGenerator: PropTypes.func,
};

export default EmbedDataContainer;
