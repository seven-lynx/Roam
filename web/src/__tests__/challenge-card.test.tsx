/**
 * Tests for the ChallengeCard presentational component.
 * Verifies title/goal/progress/XP rendering and the completed state.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';

describe('ChallengeCard', () => {
  it('renders title, goal description, progress and XP reward', () => {
    render(
      <ChallengeCard
        title="Quick Browse"
        goalDescription="Roam 10 URLs"
        goalCount={10}
        progressCurrent={4}
        xpReward={50}
        isCompleted={false}
        type="daily"
      />
    );

    expect(screen.getByText('Quick Browse')).toBeInTheDocument();
    expect(screen.getByText('Roam 10 URLs')).toBeInTheDocument();
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('renders the type label', () => {
    render(
      <ChallengeCard
        title="Weekly Explorer"
        goalDescription="Roam 50 URLs"
        goalCount={50}
        progressCurrent={0}
        xpReward={200}
        isCompleted={false}
        type="weekly"
      />
    );

    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('shows a completed indicator when finished', () => {
    render(
      <ChallengeCard
        title="Collector"
        goalDescription="Save 3 URLs"
        goalCount={3}
        progressCurrent={3}
        xpReward={60}
        isCompleted
        type="daily"
      />
    );

    expect(screen.getByTitle('Completed')).toBeInTheDocument();
  });

  it('does not show a completed indicator while in progress', () => {
    render(
      <ChallengeCard
        title="Collector"
        goalDescription="Save 3 URLs"
        goalCount={3}
        progressCurrent={1}
        xpReward={60}
        isCompleted={false}
        type="daily"
      />
    );

    expect(screen.queryByTitle('Completed')).not.toBeInTheDocument();
  });
});
