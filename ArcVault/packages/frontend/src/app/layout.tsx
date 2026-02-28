import { Inter, Cormorant_Garamond } from 'next/font/google';
import { Providers } from '@/providers';
import { AppShell } from '@/components/layout/AppShell';
import { QuickPayFAB } from '@/components/quick-pay/QuickPayFAB';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'ArcVault — Enterprise Treasury & FX',
  description: 'Enterprise treasury management and FX operations on Arc blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
          <QuickPayFAB />
        </Providers>
      </body>
    </html>
  );
}
