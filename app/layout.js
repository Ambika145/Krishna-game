import { Cinzel, Manrope } from 'next/font/google';
import './globals.css';

const display = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '500', '600', '700'],
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'Makhan Chor — Little Krishna',
  description: 'Steal the falling pots of makhan in a magical Vrindavan garden.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#070d14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased overflow-hidden overscroll-none touch-none">
        {children}
      </body>
    </html>
  );
}
