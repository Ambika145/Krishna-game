import './globals.css';

export const metadata = {
  title: 'Makhan Catch — Little Krishna',
  description: 'Catch falling pots of makhan in a magical Vrindavan garden.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1a0b2e',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden overscroll-none touch-none">
        {children}
      </body>
    </html>
  );
}
