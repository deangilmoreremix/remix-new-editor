const DEFAULT_IFRAME_STYLE = `<!--- embed styling ---->
<style>
  .iframe-container { position:relative; padding-bottom:56.25%; padding-top:30px; height:0; overflow:hidden; border:1px solid #ccc; }
  .iframe-container iframe,.iframe-container object,.iframe-container embed { position:absolute; top:0; left:0; width:100%; height:100%; }
</style>\r
<!--- End of embed styling ---->
`;

const EMAIL_STYLES = `
    margin: auto;
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center center;
    cursor: pointer;
    overflow: hidden;
`;
const PLAY_BUTTON_STYLES = `
    width: 50%;
    height: 50%;
    margin: 21% 10% auto auto;
    background-size: contain;
    background-repeat: no-repeat;
    background-repeat: no-repeat;
    background-position: right bottom;
`;

const embedScript = url => `<script>var vars={};var tempstring='';var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value){if(value){tempstring+=key+'='+value+'&';}});if (tempstring) { if (document.getElementById('vr-${url.split('/').reverse()[0]}')) {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);} else {document.addEventListener('DOMContentLoaded',function() {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);});}}</script>\n`;

const iframeTag = (url, width, height) => `<iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe>\r`;

const iframecontainer = (url, width, height) => `<div class="iframe-container">${iframeTag(url, width, height)}</div>`;

export const styledIframeWithScript = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}${embedScript(url)}}`);

export const styledIframe = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}`);

export const emailCode = (url, width, height, thumbnail, needPlayButton) => `<a href=${url}><div class='embed-email' style='background-image: url(${`${thumbnail}`}); width: ${`${width}px`}; height: ${`${height}px`}; ${EMAIL_STYLES}'>${needPlayButton ? `<div class="embed-play-button" style="${PLAY_BUTTON_STYLES} background-image: url('https://cdn.vidcloud.io/revolution/resources/play_button.png')"><p style="opacity: 1">&nbsp;</p></div>` : '<p style="opacity: 1">&nbsp;</p>'}</div></a>\r`;

export const optInTemplate = tokens => `<!-- Start of Vidcloud Embed Code --><script type="application/javascript">var tokens = ${tokens.join(' ')} window.addEventListener("load",function(){var f=tokens.split(" "),a=document.createElement("iframe");a.style.display="none";a.name="vidcloud-embed";a.src="https://int-cdn.vidcloud.io/api/embed-helper";document.body.appendChild(a);var b=document.forms["undefined"!==typeof formName&&formName||0];b&&(a=function(){for(var a=[],c=0,d=0;d<b.elements.length;d++){var e=b.elements[d];"hidden"!==e.type&&e.value&&f.length>c&&(a.push(f[c]+"="+encodeURIComponent(e.value)),c++)}document["vidcloud-embed"].postMessage({personalizedString:a.join("&")},"https://int-cdn.vidcloud.io");return!0},b.addEventListener("submit",a),b.addEventListener("click",a))});</script><!-- End of Vidcloud Embed Code -->`;
