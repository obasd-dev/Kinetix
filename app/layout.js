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
