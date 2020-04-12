const DEFAULT_IFRAME_STYLE = `<!--- embed styling ---->
<style> 
  .iframe-container { position:relative; padding-bottom:56.25%; padding-top:30px; height:0; overflow:hidden; border:1px solid #ccc; }
  .iframe-container iframe,.iframe-container object,.iframe-container embed { position:absolute; top:0; left:0; width:100%; height:100%; }
</style>\r
<!--- End of embed styling ---->
`;

const embedScript = url => `<script>var vars={};var tempstring='';var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value){if(value){tempstring+=key+'='+value+'&';}});if (tempstring) { if (document.getElementById('vr-${url.split('/').reverse()[0]}')) {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);} else {document.addEventListener('DOMContentLoaded',function() {document.getElementById('vr-${url.split('/').reverse()[0]}').src='${url}?'+tempstring.slice(0, -1);});}}</script>\n\n`;

const iframeTag = (url, width, height) => `<iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe>\r`;

const iframecontainer = (url, width, height) => `<div class="iframe-container">${iframeTag(url, width, height)}</div>`;

export const styledIframeWithScript = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}${embedScript(url)}}`);

export const styledIframe = (url, width, height) => (`${DEFAULT_IFRAME_STYLE}${iframecontainer(url, width, height)}`);
