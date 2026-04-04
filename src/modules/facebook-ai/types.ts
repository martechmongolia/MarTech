export interface FbComment {
  id: string;
  comment_id: string;
  connection_id: string;
  org_id: string;
  post_id: string;
  commenter_name: string | null;
  commenter_id: string | null;
  message: string;
  comment_type: 'question' | 'complaint' | 'spam' | 'irrelevant' | 'positive' | 'order' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  language: string;
  status: 'pending' | 'processing' | 'replied' | 'skipped' | 'failed' | 'hidden';
  created_at_facebook: string | null;
  received_at: string;
}

export interface FbReply {
  id: string;
  comment_id: string;
  org_id: string;
  draft_message: string;
  final_message: string | null;
  model_used: string;
  confidence_score: number | null;
  status: 'draft' | 'approved' | 'posted' | 'rejected' | 'edited_posted';
  reviewed_by: string | null;
  reviewed_at: string | null;
  posted_at: string | null;
  facebook_reply_id: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface FbPageConnection {
  id: string;
  org_id: string;
  page_id: string;
  page_name: string;
  page_access_token_encrypted: string;
  is_active: boolean;
  webhook_subscribed: boolean;
  settings: Record<string, unknown>;
}

export interface FbReplySettings {
  id: string;
  connection_id: string;
  auto_reply: boolean;
  reply_tone: 'friendly' | 'professional' | 'casual';
  reply_language: string;
  reply_delay_seconds: number;
  working_hours_start: string;
  working_hours_end: string;
  max_replies_per_day: number;
  custom_system_prompt: string | null;
  fallback_message: string;
}

export interface FbKnowledgeBaseItem {
  id: string;
  org_id: string;
  connection_id: string;
  question: string;
  answer: string;
  tags: string[];
  is_active: boolean;
}

export interface WebhookCommentEntry {
  commentId: string;
  postId: string;
  message: string;
  commenterName: string;
  commenterId: string;
  createdTime: number;
  pageId: string;
}

export interface AiReplyResult {
  reply: string;
  confidence: number;
  tokensUsed: number;
  commentType: FbComment['comment_type'];
  sentiment: FbComment['sentiment'];
  language: string;
}
