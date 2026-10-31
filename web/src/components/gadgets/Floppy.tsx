import Link from 'next/link';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** A single floppy disk. Clicking opens the changelog. */
export function Floppy() {
  const { artVariant } = useWorkstation();
  return (
    <Link href="/changelog" className="gadget" aria-label="Floppy disk. Open the changelog.">
      <img src={deskArt('floppy', artVariant)} alt="" className="art-img" draggable={false} />
    </Link>
  );
}
