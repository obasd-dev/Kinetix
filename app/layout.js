import './globals.css';
export const metadata = {
 title: 'KINETIX',
 description:
 'KINETIX — Social + Create + Play + Collaborate. Discover people, projects, communities and ideas.',
};
export const viewport = {
 width: 'device-width',
 initialScale: 1,
 viewportFit: 'cover',
 themeColor: '#0b1020',
};
export default function RootLayout({ children }) {
 return (
 <html lang="en">
 <body>
 <div id="kinetix-root">
 {children}
 </div>
 </body>
 </html>
 );
}
globals.css
/* KINETIX global foundation
 Keep this file if your page.js contains component-level styles.
*/
:root {
 color-scheme: dark;
 --kinetix-bg: #0b1020;
 --kinetix-surface: #111827;
 --kinetix-surface-2: #172033;
 --kinetix-text: #f8fafc;
 --kinetix-muted: #94a3b8;
 --kinetix-border: rgba(148, 163, 184, 0.16);
 --kinetix-accent: #38bdf8;
}
* {
 box-sizing: border-box;
}
html,
body {
 margin: 0;
 padding: 0;
 min-height: 100%;
 background: var(--kinetix-bg);
 color: var(--kinetix-text);
}
body {
 min-width: 320px;
 font-family:
 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
 "Segoe UI", sans-serif;
 -webkit-font-smoothing: antialiased;
 text-rendering: optimizeLegibility;
}
button,
input,
textarea,
select {
 font: inherit;
}
button {
 -webkit-tap-highlight-color: transparent;
}
a {
 color: inherit;
 text-decoration: none;
}
img,
video {
 max-width: 100%;
 display: block;
}
#kinetix-root {
 min-height: 100vh;
 width: 100%;
}
::selection {
 background: rgba(56, 189, 248, 0.25);
}
