'use client';

export const FlagPT = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15">
    <path fill="#006233" d="M0 0h8v15H0z" />
    <path fill="#D21034" d="M8 0h12v15H8z" />
    <circle cx="8" cy="7.5" r="2.5" fill="#FFE000" />
    <path fill="none" stroke="#D21034" strokeWidth="0.5" d="M8 5a2.5 2.5 0 000 5m-1.5-3.5h3" />
  </svg>
);

export const FlagDE = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15">
    <path fill="#000" d="M0 0h20v5H0z" />
    <path fill="#D00" d="M0 5h20v5H0z" />
    <path fill="#FFCE00" d="M0 10h20v5H0z" />
  </svg>
);

export const FlagES = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15">
    <path fill="#C60B1E" d="M0 0h20v3.75H0zM0 11.25h20V15H0z" />
    <path fill="#FFC400" d="M0 3.75h20v7.5H0z" />
  </svg>
);

export const FlagUK = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 60 30">
    <clipPath id="s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
    <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

export const countryFlags: Record<string, React.ReactNode> = {
  PT: <FlagPT />,
  DE: <FlagDE />,
  ES: <FlagES />,
  GB: <FlagUK />,
};
