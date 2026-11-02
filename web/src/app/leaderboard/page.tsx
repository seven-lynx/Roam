import type { Metadata } from 'next';
import { RankingsClient } from './RankingsClient';

export const metadata: Metadata = { title: 'Rankings' };

export default function RankingsPage() {
  return <RankingsClient />;
}