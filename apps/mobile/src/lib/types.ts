export type Topic = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  following: boolean;
};

export type Person = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  following: boolean;
};

export type Option = {
  id: string;
  label: string;
  image_url: string | null;
  position: number;
  vote_count: number | null;
  percent: number | null;
};

export type Poll = {
  id: string;
  question: string;
  question_image_url: string | null;
  status?: string;
  review_message?: string | null;
  created_at: string;
  topic: Topic;
  author: Person;
  options: Option[];
  total_votes: number | null;
  viewer_vote_option_id: string | null;
  skipped: boolean;
  is_author?: boolean;
};

export type Feed = {
  poll: Poll | null;
  guest_votes_used: number;
  guest_votes_remaining: number;
  signed_in: boolean;
};

export type SessionUser = Person & { email?: string | null; handle_set?: boolean; is_admin?: boolean };
