import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentType } from 'react';
import { SnakeProgram } from '@/components/programs/SnakeProgram';
import { MinesweeperProgram } from '@/components/programs/MinesweeperProgram';
import { TetrisProgram } from '@/components/programs/TetrisProgram';
import { AsteroidsProgram } from '@/components/programs/AsteroidsProgram';

// The program wrappers only read `isOpen` from the workstation context; window
// chrome (Window) additionally needs the top/dock bar heights at module scope.
jest.mock('@/components/WorkstationContext', () => ({
  useWorkstation: () => ({ isOpen: () => false, windows: {} }),
  TOP_BAR_H: 40,
  DOCK_H: 44,
}));

describe('program windows', () => {
  it.each<[string, ComponentType]>([
    ['snake', SnakeProgram],
    ['minesweeper', MinesweeperProgram],
    ['tetris', TetrisProgram],
    ['asteroids', AsteroidsProgram],
  ])('renders nothing when %s is closed', (_name, Component) => {
    const { container } = render(<Component />);
    expect(container).toBeEmptyDOMElement();
  });
});
