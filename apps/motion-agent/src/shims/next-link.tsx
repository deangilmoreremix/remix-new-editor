import React from "react";
import { navigate } from "./router";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
};

const Link = React.forwardRef<HTMLAnchorElement, Props>(({ href, prefetch: _p, replace, onClick, ...rest }, ref) => {
  const external = /^[a-z]+:/i.test(href);
  return (
    <a
      ref={ref}
      href={external ? href : `#${href}`}
      onClick={(e) => {
        onClick?.(e);
        if (external || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href, replace);
      }}
      {...rest}
    />
  );
});
Link.displayName = "Link";
export default Link;
