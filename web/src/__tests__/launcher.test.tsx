import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Launcher } from '@/components/Launcher';

const mockSetInspect = jest.fn();
const mockSetLauncherOpen = jest.fn();

// AuthProvider creates a Supabase client at module scope; mock it so importing
// the launcher (which reads the session via useAuth) doesn't require env vars.
jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ session: null }),
}));

jest.mock('@/components/WorkstationContext', () => ({
  useWorkstation: () => ({
    launcherOpen: true,
    setLauncherOpen: mockSetLauncherOpen,
    openWindow: jest.fn(),
    setInspect: mockSetInspect,
    showAlert: jest.fn(),
    showConfirm: jest.fn(),
    handheld: false,
    openAppView: jest.fn(),
    openUrl: jest.fn(),
  }),
}));

describe('Launcher', () => {
  beforeEach(() => {
    mockSetInspect.mockClear();
    mockSetLauncherOpen.mockClear();
  });

  it('no longer offers "Cyberdeck view" as a footer control or a menu item', () => {
    render(<Launcher />);
    expect(screen.queryByLabelText('Cyberdeck view')).toBeNull();
    expect(screen.queryByText('Cyberdeck view')).toBeNull();
  });

  it('keeps the footer Inspect control and hands it to the workstation', async () => {
    const user = userEvent.setup();
    render(<Launcher />);
    await user.click(screen.getByLabelText('Inspect'));
    expect(mockSetInspect).toHaveBeenCalledWith(true);
    expect(mockSetLauncherOpen).toHaveBeenCalledWith(false);
  });

  it('keeps the "Inspect the deck" system item working', async () => {
    const user = userEvent.setup();
    render(<Launcher />);
    await user.click(screen.getByText('Inspect the deck'));
    expect(mockSetInspect).toHaveBeenCalledWith(true);
  });
});