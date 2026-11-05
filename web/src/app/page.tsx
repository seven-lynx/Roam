import { HomeGate } from '@/components/HomeGate';
import ClassicHome from '@/components/ClassicHome';

export default function HomePage() {
  return (
    <HomeGate>
      <ClassicHome />
    </HomeGate>
  );
}
