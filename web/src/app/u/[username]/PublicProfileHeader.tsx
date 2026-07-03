'use client';

import { useState } from 'react';
import { Avatar } from '@/components/UI';
import { CopyProfileLink } from './CopyProfileLink';
import { FollowButton } from './FollowButton';
import { FollowSection } from './FollowSection';

interface Props {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
  };
  viewer: { id: string } | null;
  initialStatus: 'none' | 'following';
  followerCount: number;
  followingCount: number;
}

// Wraps the avatar row + follow button + follow counts as a single client component
// so they can share follow state without page-level prop drilling through a Server Component.
export function PublicProfileHeader({
  profile,
  viewer,
  initialStatus,
  followerCount,
  followingCount,
}: Props) {
  const [followVersion, setFollowVersion] = useState(0);
  const isOwnProfile = viewer?.id === profile.id;

  return (
    <>
      {/* Avatar row */}
      <div className="flex items-center gap-5">
        <Avatar name={profile.display_name || profile.username} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
          <div className="flex items-center gap-1 mt-1">
            <CopyProfileLink username={profile.username} />
          </div>
        </div>
        {!isOwnProfile && (
          <FollowButton
            targetUserId={profile.id}
            initialStatus={initialStatus}
            onFollowChange={() => setFollowVersion(v => v + 1)}
          />
        )}
      </div>

      {/* Follower / following counts + expandable lists */}
      <FollowSection
        profileId={profile.id}
        followerCount={followerCount}
        followingCount={followingCount}
        followVersion={followVersion}
      />
    </>
  );
}