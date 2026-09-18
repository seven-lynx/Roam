import type { Metadata } from 'next';
import { BadgeGalleryClient } from './BadgeGalleryClient';

export const metadata: Metadata = { title: 'Badge Gallery' };

export default function BadgeGalleryPage() {
  return <BadgeGalleryClient />;
}