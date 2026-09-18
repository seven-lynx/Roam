/**
 * Tests for shared UI components (UI.tsx).
 * Verifies: Button, Input, Card, Spinner, LoadingPage, Avatar, avatarPalette, Toast
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  Button,
  Input,
  Card,
  Spinner,
  LoadingPage,
  Avatar,
  avatarPalette,
  Toast,
} from '@/components/UI';

// ─── Spinner ───────────────────────────────────────────────────────────────────

describe('Spinner', () => {
  it('renders an accessible SVG indicator', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('has the animate-spin class on its wrapper', () => {
    const { container } = render(<Spinner />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('animate-spin');
  });
});

// ─── LoadingPage ───────────────────────────────────────────────────────────────

describe('LoadingPage', () => {
  it('renders a full-height centered container', () => {
    const { container } = render(<LoadingPage />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('contains a Spinner', () => {
    const { container } = render(<LoadingPage />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

// ─── Card ──────────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renders children inside a styled container', () => {
    render(<Card><p data-testid="child">Hello</p></Card>);
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('merges additional className', () => {
    const { container } = render(<Card className="extra-class">Content</Card>);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('extra-class');
  });

  it('renders without className prop', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ─── Button ────────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('renders with default primary variant', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-zinc-900');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-zinc-100');
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-red-600');
  });

  it('applies additional className', () => {
    render(<Button className="w-full">Full</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('w-full');
  });

  it('passes standard button attributes', () => {
    render(<Button disabled type="submit" aria-label="Submit form">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toHaveAttribute('aria-label', 'Submit form');
  });

  it('fires onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ─── Input ─────────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders a label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    // label should be associated with the input via htmlFor
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('renders without a label', () => {
    render(<Input />);
    expect(screen.queryByRole('label')).not.toBeInTheDocument();
  });

  it('shows error message and red border when error is set', () => {
    render(<Input label="Name" error="Name is required" />);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toHaveClass('text-red-600');

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
  });

  it('does not show error when error is not set', () => {
    render(<Input label="Name" />);
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('passes standard input attributes', () => {
    render(
      <Input
        type="email"
        placeholder="you@example.com"
        maxLength={100}
        required
        data-testid="email-input"
      />
    );
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'you@example.com');
    expect(input).toHaveAttribute('maxLength', '100');
    expect(input).toBeRequired();
  });

  it('fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Input onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');
    expect(onChange).toHaveBeenCalled();
  });
});

// ─── avatarPalette ─────────────────────────────────────────────────────────────

describe('avatarPalette', () => {
  it('returns a 2-element readonly tuple for any input', () => {
    const result = avatarPalette('Alice');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe('string');
    expect(typeof result[1]).toBe('string');
  });

  it('returns consistent colors for the same name', () => {
    const a = avatarPalette('Bob');
    const b = avatarPalette('Bob');
    expect(a[0]).toBe(b[0]);
    expect(a[1]).toBe(b[1]);
  });

  it('returns potentially different colors for different names', () => {
    // It's possible for a hash collision here (1/13 chance), but highly unlikely
    // for two specific different strings. We check they're valid palette entries.
    const a = avatarPalette('Alice');
    const b = avatarPalette('ZaphodBeeblebrox');
    expect(a[0]).toMatch(/^bg-/);
    expect(b[0]).toMatch(/^bg-/);
  });

  it('handles empty string gracefully', () => {
    const result = avatarPalette('');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^bg-/);
  });

  it('handles single character name', () => {
    const result = avatarPalette('A');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^bg-/);
  });
});

// ─── Avatar ────────────────────────────────────────────────────────────────────

describe('Avatar', () => {
  it('displays the first letter of the name uppercase', () => {
    render(<Avatar name="Charlie" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('displays ? when name is empty', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders with default size md', () => {
    const { container } = render(<Avatar name="Dana" />);
    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('w-10', 'h-10', 'text-sm');
  });

  it('renders small size', () => {
    const { container } = render(<Avatar name="Eve" size="sm" />);
    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('w-8', 'h-8', 'text-xs');
  });

  it('renders large size', () => {
    const { container } = render(<Avatar name="Frank" size="lg" />);
    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('w-16', 'h-16', 'text-xl');
  });

  it('has rounded-full class for circle shape', () => {
    const { container } = render(<Avatar name="Grace" />);
    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('rounded-full');
  });
});

// ─── Toast ─────────────────────────────────────────────────────────────────────

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Item saved!" onDismiss={jest.fn()} />);
    expect(screen.getByText('Item saved!')).toBeInTheDocument();
  });

  it('renders error variant by default with red styling', () => {
    const { container } = render(<Toast message="Error occurred" onDismiss={jest.fn()} />);
    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-red-100');
  });

  it('renders success variant with green styling', () => {
    const { container } = render(<Toast message="Success!" variant="success" onDismiss={jest.fn()} />);
    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-green-100');
  });

  it('renders info variant with blue styling', () => {
    const { container } = render(<Toast message="FYI" variant="info" onDismiss={jest.fn()} />);
    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-blue-100');
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    render(<Toast message="Dismiss me" onDismiss={onDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has fixed positioning classes', () => {
    const { container } = render(<Toast message="Fixed" onDismiss={jest.fn()} />);
    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('fixed', 'bottom-4', 'right-4', 'z-50');
  });
});