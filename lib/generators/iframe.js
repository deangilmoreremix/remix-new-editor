import { DEFAULT_THUMBNAIL } from '../constants/project';

const DEFAULT_IFRAME_STYLE = `<!--- embed styling ---->
<style>
  .iframe-container { position:relative; padding-bottom:56.25%; padding-top:30px; height:0; overflow:hidden; border:1px solid #ccc; }
  .iframe-container iframe,.iframe-container object,.iframe-container embed { position:absolute; top:0; left:0; width:100%; height:100%; }
</style>\r
<!--- End of embed styling ---->
`;

const STYLE_OPEN = '<style>\r';
const STYLE_CLOSE = '</style>\r';
const EMAIL_STYLES = `
  .embed-email {
    position:relative;
    margin: auto;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center center;
  }
`;
const PLAY_BUTTON_STYLES = `
  .embed-play-button {
    position: absolute;
    right: 0;
    top: 50%;
    -moz-transform: translate(-2%, -25%);
    -ms-transform: translate(-2%, -25%);
    -o-transform: translate(-2%, -25%);
    transform: translate(-2%, -25%);
  }
`;

const embedScript = url => `<script>var vars={};var tempstring='';var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value){if(value){tempstring+=key+'='+value+'&';}});if (tempstring) { if (document.getElementById('vr-${url.split('/').reverse()[0]}')) {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);} else {document.addEventListener('DOMContentLoaded',function() {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);});}}</script>\n`;

const iframeTag = (url, width, height) => `<iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe>\r`;

const iframecontainer = (url, width, height) => `<div class="iframe-container">${iframeTag(url, width, height)}</div>`;

export const styledIframeWithScript = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}${embedScript(url)}}`);

export const styledIframe = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}`);

export const emailCode = (url, width, height, thumbnail, needPlayButton) => `${STYLE_OPEN}${EMAIL_STYLES}${needPlayButton ? PLAY_BUTTON_STYLES : ''}${STYLE_CLOSE}<a href=${url}><div class='embed-email' style='background-image: url(${`${thumbnail}`}); width: ${`${width}px`}; height: ${`${height}px`};'>${needPlayButton ? '<img class="embed-play-button" src="https://cdn.vidcloud.io/revolution/resources/play_button.svg"/>' : ''}</div></a>\r`;

export const optInTemplate = tokens => `<!-- Start of Vidcloud Embed Code --><script type="application/javascript">var tokens = ${tokens.join(' ')} window.addEventListener("load",function(){var f=tokens.split(" "),a=document.createElement("iframe");a.style.display="none";a.name="vidcloud-embed";a.src="https://int-cdn.vidcloud.io/api/embed-helper";document.body.appendChild(a);var b=document.forms["undefined"!==typeof formName&&formName||0];b&&(a=function(){for(var a=[],c=0,d=0;d<b.elements.length;d++){var e=b.elements[d];"hidden"!==e.type&&e.value&&f.length>c&&(a.push(f[c]+"="+encodeURIComponent(e.value)),c++)}document["vidcloud-embed"].postMessage({personalizedString:a.join("&")},"https://int-cdn.vidcloud.io");return!0},b.addEventListener("submit",a),b.addEventListener("click",a))});</script><!-- End of Vidcloud Embed Code -->`;
