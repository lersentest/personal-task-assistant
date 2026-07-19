import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit access',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuditAccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
