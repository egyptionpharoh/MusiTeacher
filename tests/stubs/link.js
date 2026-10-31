import React from 'react';
export default function Link({ href, children, prefetch, ...r }) { return React.createElement('a', { href: '#' + href, ...r }, children); }
