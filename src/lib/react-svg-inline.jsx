// Shim for react-svg-inline: render SVG files as <img> tags
import React from 'react';

export default function SVGInline({ svg, className, ...rest }) {
  if (!svg || typeof svg !== 'string') {
    return null;
  }
  return <img src={svg} alt="" className={className || ''} {...rest} />;
}
