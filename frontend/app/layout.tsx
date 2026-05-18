import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenReview',
  description: 'Real-time collaborative code review',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gh-bg text-gh-textPrimary min-h-screen">{children}</body>
    </html>
  );
}
