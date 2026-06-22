export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
  Relationships extends Relationship[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type AppRole = "admin" | "user";
export type PremiumOrderStatus = "pending" | "awaiting_proof" | "confirmed" | "rejected";
export type WalletTxType =
  | "credit"
  | "debit"
  | "hold"
  | "release"
  | "withdrawal"
  | "commission"
  | "refund"
  | "adjustment";
export type WithdrawalStatus = "requested" | "approved" | "paid" | "rejected" | "cancelled";
export type MpOrderStatus =
  | "awaiting_payment"
  | "paid"
  | "delivered"
  | "released"
  | "disputed"
  | "refunded"
  | "cancelled";
export type ListingStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "paused"
  | "sold_out"
  | "rejected"
  | "removed";
export type DeliveryType = "manual" | "instant_code" | "service";
export type SellerLevel = "bronze" | "silver" | "gold" | "diamond" | "elite";
export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_buyer"
  | "resolved_seller"
  | "closed";
export type TicketCategory = "support" | "financial" | "dispute" | "sales" | "bug" | "security";
export type TicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
export type ReportTarget = "listing" | "user" | "review" | "message";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "trialing" | "paused";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_premium: boolean;
  premium_until: string | null;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: SubscriptionStatus | null;
  subscription_current_period_end: string | null;
  is_seller: boolean;
  seller_verified: boolean;
  buyer_strikes: number;
  suspended_until: string | null;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type ScriptRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  code: string;
  game_name: string | null;
  game_image_url: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  is_premium: boolean;
  is_featured: boolean;
  is_verified: boolean;
  has_key: boolean;
  is_obfuscated: boolean;
  quality_score: number | null;
  points_rewarded: number | null;
  likes_count: number | null;
  user_id: string | null;
  status: string | null;
  views: number;
  copies: number;
  tags: string[] | null;
  supported_executors: string[] | null;
  game_link: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type ExecutorRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  download_url: string;
  image_url: string | null;
  price_brl: number;
  is_free: boolean;
  supported_games: string[] | null;
  platform: string[] | null;
  is_featured: boolean;
  downloads: number;
  created_at: string;
  updated_at: string;
  status: string;
  security_status: string;
  safety_level: string;
  detection_status: string;
  is_recommended: boolean;
  version: string | null;
  key_system: boolean;
  official_site: string | null;
  discord_url: string | null;
  github_url: string | null;
  tutorial_url: string | null;
  downloads_json: Record<string, any>[] | null;
  trust_score: number;
  trust_score_components: Record<string, any> | null;
  rating: number;
  likes_count: number;
  dislikes_count: number;
  liked_by: string[] | null;
  disliked_by: string[] | null;
  badges: string[] | null;
  rank: number | null;
  developer: string | null;
  execution_method: string | null;
  requirements: string | null;
  features: string[] | null;
  review_count: number;
};

type ExecutorReviewRow = {
  id: string;
  executor_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  is_working: boolean | null;
  is_detected: boolean | null;
  has_bugs: boolean | null;
  created_at: string;
};

type ExecutorCommentRow = {
  id: string;
  executor_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type PremiumPlanRow = {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price_brl: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  features: string[] | null;
  created_at: string;
};

type PremiumOrderRow = {
  id: string;
  user_id: string;
  plan_id: string;
  amount_brl: number;
  status: PremiumOrderStatus;
  pix_proof_url: string | null;
  user_notes: string | null;
  admin_notes: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

type OrderMessageRow = {
  id: string;
  order_id: string;
  user_id: string;
  message: string;
  attachment_url: string | null;
  is_admin: boolean;
  created_at: string;
};

type PixSettingsRow = {
  id: number;
  pix_key: string;
  pix_key_type: string;
  recipient_name: string;
  instructions: string;
  updated_at: string;
};

type SellerProfileRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  kyc_status: KycStatus;
  verified: boolean;
  level: SellerLevel;
  rating: number;
  total_reviews: number;
  total_sales: number;
  total_cancelled: number;
  response_time_minutes: number | null;
  risk_score: number;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
};

type KycVerificationRow = {
  id: string;
  user_id: string;
  full_name: string;
  document_type: string;
  document_number: string;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MarketplaceCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ListingRow = {
  id: string;
  seller_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  short_description: string | null;
  description: string;
  game_name: string | null;
  delivery_type: DeliveryType;
  price_cents: number;
  original_price_cents: number | null;
  stock: number;
  unlimited_stock: boolean;
  cover_image_url: string | null;
  video_url: string | null;
  tags: string[] | null;
  status: ListingStatus;
  rejection_reason: string | null;
  views: number;
  sales_count: number;
  rating: number;
  total_reviews: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type ListingImageRow = {
  id: string;
  listing_id: string;
  url: string;
  sort_order: number;
  created_at: string;
};

type ListingQuestionRow = {
  id: string;
  listing_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

type MarketplaceOrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  gateway_fee_cents: number;
  platform_fee_cents: number;
  seller_amount_cents: number;
  status: MpOrderStatus;
  payment_method: string;
  payment_proof_url: string | null;
  delivered_at: string | null;
  auto_release_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MarketplaceChatRoomRow = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

type MarketplaceChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  system_message: boolean;
  created_at: string;
};

type TransactionRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  marketplace_order_id: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  seller_amount_cents: number;
  currency: string;
  status: "pending" | "held" | "disputed" | "released" | "refunded" | "cancelled";
  release_at: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  disputed_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

type DisputeRow = {
  id: string;
  order_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type DisputeMessageRow = {
  id: string;
  dispute_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
};

type WalletRow = {
  id: string;
  user_id: string;
  available_cents: number;
  pending_cents: number;
  blocked_cents: number;
  created_at: string;
  updated_at: string;
};

type WalletTransactionRow = {
  id: string;
  wallet_id: string;
  user_id: string;
  type: WalletTxType;
  amount_cents: number;
  description: string | null;
  related_order_id: string | null;
  related_withdrawal_id: string | null;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  pix_key: string;
  pix_key_type: string;
  status: WithdrawalStatus;
  receipt_url: string | null;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  order_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type TicketRow = {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  related_order_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type TicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Partial<ProfileRow> & { id: string }>;
      user_roles: Table<UserRoleRow, Partial<UserRoleRow> & { user_id: string; role: AppRole }>;
      categories: Table<CategoryRow, Partial<CategoryRow> & { name: string; slug: string }>;
      scripts: Table<ScriptRow, Partial<ScriptRow> & { title: string; slug: string; code: string }>;
      executors: Table<ExecutorRow, Partial<ExecutorRow> & { name: string; slug: string; download_url: string }>;
      executor_reviews: Table<ExecutorReviewRow, Partial<ExecutorReviewRow> & { executor_id: string; user_id: string; rating: number }>;
      executor_comments: Table<ExecutorCommentRow, Partial<ExecutorCommentRow> & { executor_id: string; user_id: string; content: string }>;
      premium_plans: Table<
        PremiumPlanRow,
        Partial<PremiumPlanRow> & { name: string; duration_days: number; price_brl: number }
      >;
      premium_orders: Table<
        PremiumOrderRow,
        Partial<PremiumOrderRow> & {
          user_id: string;
          plan_id: string;
          amount_brl: number;
        },
        Partial<PremiumOrderRow>,
        [
          {
            foreignKeyName: "premium_orders_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "premium_plans";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_messages: Table<
        OrderMessageRow,
        Partial<OrderMessageRow> & { order_id: string; user_id: string; message: string }
      >;
      pix_settings: Table<PixSettingsRow>;
      seller_profiles: Table<SellerProfileRow, Partial<SellerProfileRow> & { user_id: string }>;
      kyc_verifications: Table<
        KycVerificationRow,
        Partial<KycVerificationRow> & {
          user_id: string;
          full_name: string;
          document_type: string;
          document_number: string;
        }
      >;
      marketplace_categories: Table<
        MarketplaceCategoryRow,
        Partial<MarketplaceCategoryRow> & { slug: string; name: string }
      >;
      listings: Table<
        ListingRow,
        Partial<ListingRow> & {
          seller_id: string;
          slug: string;
          title: string;
          description: string;
          price_cents: number;
        },
        Partial<ListingRow>,
        [
          {
            foreignKeyName: "listings_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      listing_images: Table<
        ListingImageRow,
        Partial<ListingImageRow> & { listing_id: string; url: string },
        Partial<ListingImageRow>,
        [
          {
            foreignKeyName: "listing_images_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ]
      >;
      listing_questions: Table<
        ListingQuestionRow,
        Partial<ListingQuestionRow> & {
          listing_id: string;
          user_id: string;
          question: string;
        },
        Partial<ListingQuestionRow>,
        [
          {
            foreignKeyName: "listing_questions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ]
      >;
      marketplace_orders: Table<
        MarketplaceOrderRow,
        Partial<MarketplaceOrderRow> & {
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          amount_cents: number;
          seller_amount_cents: number;
        },
        Partial<MarketplaceOrderRow>,
        [
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ]
      >;
      marketplace_chat_rooms: Table<
        MarketplaceChatRoomRow,
        Partial<MarketplaceChatRoomRow> & {
          order_id: string;
          buyer_id: string;
          seller_id: string;
        }
      >;
      marketplace_chat_messages: Table<
        MarketplaceChatMessageRow,
        Partial<MarketplaceChatMessageRow> & { room_id: string; sender_id: string }
      >;
      transactions: Table<
        TransactionRow,
        Partial<TransactionRow> & {
          buyer_id: string;
          seller_id: string;
          listing_id: string;
          amount_cents: number;
          seller_amount_cents: number;
          release_at: string;
        }
      >;
      disputes: Table<
        DisputeRow,
        Partial<DisputeRow> & { order_id: string; opened_by: string; reason: string }
      >;
      dispute_messages: Table<
        DisputeMessageRow,
        Partial<DisputeMessageRow> & { dispute_id: string; sender_id: string }
      >;
      wallets: Table<WalletRow, Partial<WalletRow> & { user_id: string }>;
      wallet_transactions: Table<
        WalletTransactionRow,
        Partial<WalletTransactionRow> & {
          wallet_id: string;
          user_id: string;
          type: WalletTxType;
          amount_cents: number;
        }
      >;
      withdrawals: Table<
        WithdrawalRow,
        Partial<WithdrawalRow> & {
          user_id: string;
          amount_cents: number;
          pix_key: string;
          pix_key_type: string;
        }
      >;
      reviews: Table<
        ReviewRow,
        Partial<ReviewRow> & {
          order_id: string;
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          rating: number;
        }
      >;
      tickets: Table<
        TicketRow,
        Partial<TicketRow> & {
          user_id: string;
          category: TicketCategory;
          subject: string;
        }
      >;
      ticket_messages: Table<
        TicketMessageRow,
        Partial<TicketMessageRow> & { ticket_id: string; sender_id: string; body: string }
      >;
      reports: Table<
        ReportRow,
        Partial<ReportRow> & {
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: string;
        }
      >;
      audit_logs: Table<AuditLogRow, Partial<AuditLogRow> & { action: string }>;
      webhook_events: Table<
        { id: string; type: string; created_at: string },
        { id: string; type: string },
        Partial<{ id: string; type: string; created_at: string }>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: AppRole };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      order_status: PremiumOrderStatus;
      seller_level: SellerLevel;
      kyc_status: KycStatus;
      listing_status: ListingStatus;
      delivery_type: DeliveryType;
      mp_order_status: MpOrderStatus;
      dispute_status: DisputeStatus;
      wallet_tx_type: WalletTxType;
      withdrawal_status: WithdrawalStatus;
      ticket_category: TicketCategory;
      ticket_status: TicketStatus;
      report_target: ReportTarget;
    };
    CompositeTypes: Record<string, never>;
  };
}
