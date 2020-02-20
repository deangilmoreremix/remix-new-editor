import * as React from 'react';

export default ({ items }) => (
  <div>
    {items.map(({ label, action, re }) => (
      <button onClick={action}>
        {label}
      </button>
    ))}
  </div>
);
