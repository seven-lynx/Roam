'use client';

import { useState } from 'react';
import { FollowButton } from './FollowButton';
import { FollowSection } from './FollowSection';

interface Props {
  targetUserId: string;
  initialStatus: 'none' | 'following';
  profileId: string;
  followerCount: number;
  followingCount: number;
}

export function FollowInteractionZone({
  targetUserId,
  initialStatus,
  profileId,
  followerCount,
  followingCount,
}: Props) {
  const [followVersion, setFollowVersion] = useState(0);

  return (
    <>
      <FollowButton
        targetUserId={targetUserId}
        initialStatus={initialStatus}
        onFollowChange={() => setFollowVersion(v => v + 1)}
      />
      <FollowSection
        profileId={profileId}
        followerCount={followerCount}
        followingCount={followingCount}
        followVersion={followVersion}
      />
    </>
  );
}
