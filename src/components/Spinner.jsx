import React from 'react';

export default function Spinner({ size = 14, color = '#2563eb', ariaLabel = 'loading' }) {
  // SVG-based spinner using animateTransform to avoid global CSS/keyframes
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}
    >
      <g>
        <circle cx="25" cy="25" r="20" fill="none" stroke="#e6eefb" strokeWidth="5" />
        <path
          d="M45 25a20 20 0 0 1-6.7 14.3"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
}
