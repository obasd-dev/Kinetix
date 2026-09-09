import './globals.css'; // Make sure globals.css is imported here

export const metadata = {
  title: 'Kinetix',
  description: 'Next-gen social platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
