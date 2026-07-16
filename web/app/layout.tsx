import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Personal Task Assistant',
  description: 'Личный интерфейс управления задачами и проектами',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var storedAppearance = localStorage.getItem('personal-tasks.appearance') || localStorage.getItem('theme') || 'light';
                  var appearance = storedAppearance === 'dark' ? 'dark' : 'light';
                  document.documentElement.dataset.uiMode = 'focus';
                  document.documentElement.dataset.appearance = appearance;
                  document.documentElement.classList.toggle('dark', appearance === 'dark');
                } catch (error) {
                  document.documentElement.dataset.uiMode = 'focus';
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
