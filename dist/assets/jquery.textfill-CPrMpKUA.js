/**
 * @preserve  textfill
 * @name      jquery.textfill.js
 * @author    Russ Painter
 * @author    Yu-Jie Lin
 * @author    Alexandre Dantas
 * @version   0.6.0
 * @date      2014-08-19
 * @copyright (c) 2014 Alexandre Dantas
 * @copyright (c) 2012-2013 Yu-Jie Lin
 * @copyright (c) 2009 Russ Painter
 * @license   MIT License
 * @homepage  https://github.com/jquery-textfill/jquery-textfill
 * @example   http://jquery-textfill.github.io/jquery-textfill/index.html
 */
var i;(i=window.jQuery).fn.textfill=function(e){var t=i.extend({debug:!1,maxFontPixels:40,minFontPixels:4,innerTag:"span",widthOnly:!1,success:null,callback:null,fail:null,complete:null,explicitWidth:null,explicitHeight:null,changeLineHeight:!1},e);function n(){t.debug&&"undefined"!=typeof console&&console.debug}function l(i,e,t,l,s,h){function c(i,e){var t=" / ";return i>e?t=" > ":i==e&&(t=" = "),t}n("[TextFill] "+i+" { font-size: "+e.css("font-size")+",Height: "+e.height()+"px "+c(e.height(),t)+t+"px,Width: "+e.width()+c(e.width(),l)+l+",minFontPixels: "+s+"px, maxFontPixels: "+h+"px }")}function s(i,e,t,n,s,h,c,a){for(l(i,e,s,h,c,a);c<a-1;){var o=Math.floor((c+a)/2);if(e.css("font-size",o),t.call(e)<=n){if(c=o,t.call(e)==n)break}else a=o;l(i,e,s,h,c,a)}return e.css("font-size",a),t.call(e)<=n&&l(i+"* ",e,s,h,c=a,a),c}return n("[TextFill] Start Debug"),this.each(function(){var e=i(t.innerTag+":visible:first",this),l=t.explicitHeight||i(this).height(),h=t.explicitWidth||i(this).width(),c=e.css("font-size"),a=parseFloat(e.css("line-height"))/parseFloat(c);n("[TextFill] Inner text: "+e.text()),n("[TextFill] All options: ",t),n("[TextFill] Maximum sizes: { Height: "+l+"px, Width: "+h+"px }");var o,x=t.minFontPixels,f=t.maxFontPixels<=0?l:t.maxFontPixels,r=void 0;if(t.widthOnly||(r=s("Height",e,i.fn.height,l,l,h,x,f)),o=s("Width",e,i.fn.width,h,l,h,x,f),t.widthOnly)e.css({"font-size":o,"white-space":"nowrap"}),t.changeLineHeight&&e.parent().css("line-height",a*o+"px");else{var u=Math.min(r,o);e.css("font-size",u),t.changeLineHeight&&e.parent().css("line-height",a*u+"px")}n("[TextFill] Finished { Old font-size: "+c+", New font-size: "+e.css("font-size")+" }"),e.width()>h||e.height()>l&&!t.widthOnly?(e.css("font-size",c),t.fail&&t.fail(this),n("[TextFill] Failure { Current Width: "+e.width()+", Maximum Width: "+h+", Current Height: "+e.height()+", Maximum Height: "+l+" }")):t.success?t.success(this):t.callback&&("undefined"!=typeof console&&console.warn,t.callback(this))}),t.complete&&t.complete(this),n("[TextFill] End Debug"),this};
