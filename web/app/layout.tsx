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
                  var mode = localStorage.getItem('personal-tasks.interfaceMode') || 'classic';
                  var appearance = localStorage.getItem('personal-tasks.appearance') || localStorage.getItem('theme') || 'system';
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var resolved = appearance === 'system' ? (prefersDark ? 'dark' : 'light') : appearance;
                  document.documentElement.dataset.uiMode = mode === 'focus' ? 'focus' : 'classic';
                  document.documentElement.dataset.appearance = appearance;
                  document.documentElement.classList.toggle('dark', resolved === 'dark');
                } catch (error) {
                  document.documentElement.dataset.uiMode = 'classic';
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
