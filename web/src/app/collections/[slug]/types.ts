export interface CollectionData {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  profiles: { username: string; display_name: string } | null;
}

export interface CollectionUrl {
  id: string;
  title: string | null;
  original_url: string;
  description: string | null;
  og_image_url: string | null;
  upvotes: number;
  downvotes: number;
}

export interface CollectionItem {
  id: string;
  added_at: string;
  urls: CollectionUrl | null;
}