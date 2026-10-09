import type { Metadata } from 'next';
import { ChallengesClient } from './ChallengesClient';

export const metadata: Metadata = { title: 'Challenges' };

export default function ChallengesPage() {
  return <ChallengesClient />;
}
