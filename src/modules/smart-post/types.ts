export type PostTone = 'friendly' | 'professional' | 'funny' | 'informative' | 'urgent';
export type PostContentType = 'text' | 'photo' | 'video' | 'reel' | 'story' | 'link';

export interface GeneratePostInput {
  orgId: string;
  pageId?: string;
  topic: string;
  tone: PostTone;
  contentType: PostContentType;
  additionalContext?: string;
  language?: 'mn' | 'en';
  includeHashtags?: boolean;
  includeEmoji?: boolean;
}

export interface SimilarPost {
  id: string;
  postId: string;
  content: string;
  engagementScore: number;
  engagementRate: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  postedAt: string | null;
  contentType: string;
  similarity: number;
}

export interface PerformancePrediction {
  estimatedReach: number;
  estimatedEngagementRate: number;
  bestPostingTime: string;
  confidence: 'low' | 'medium' | 'high';
  basedOnPosts: number;
}

export interface GeneratedPost {
  id: string;
  content: string;
  alternativeVersions: string[];
  similarPosts: SimilarPost[];
  performancePrediction: PerformancePrediction | null;
  tokensUsed: number;
}
