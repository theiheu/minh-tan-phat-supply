-- 0069_ai_rag_system.sql
-- Hệ thống lưu trữ Tri thức (RAG), Lịch sử đàm thoại AI và các RPC truy vấn tối ưu cho AI Assistant.

-- 1. Kích hoạt Extension pgvector và pg_trgm
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- 2. Bảng Tài liệu tri thức (Documents) với Content Hash để chống re-index
create table if not exists public.ai_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  content_hash text not null,
  title text not null,
  category text not null check (category in ('sop', 'user_guide', 'catalog', 'policy', 'general')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Bảng Phân đoạn tri thức (Chunks) kết hợp Full-Text Search và Vector Embedding
create table if not exists public.ai_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding extensions.vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes cho tìm kiếm tri thức siêu tốc
create index if not exists ai_knowledge_chunks_tsv_idx on public.ai_knowledge_chunks using gin (tsv);
create index if not exists ai_knowledge_chunks_doc_idx on public.ai_knowledge_chunks(document_id);

-- 4. Bảng Phiên hội thoại AI (Conversations)
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Cuộc trò chuyện mới',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Bảng Tin nhắn hội thoại (Messages)
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb,
  tool_results jsonb,
  created_at timestamptz default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at asc);

-- 6. Phân quyền RLS
alter table public.ai_knowledge_documents enable row level security;
alter table public.ai_knowledge_chunks enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Policies cho Knowledge (Mọi user đăng nhập đều được đọc tài liệu)
drop policy if exists "Authenticated users can read ai knowledge documents" on public.ai_knowledge_documents;
create policy "Authenticated users can read ai knowledge documents"
  on public.ai_knowledge_documents for select to authenticated using (true);

drop policy if exists "Authenticated users can read ai knowledge chunks" on public.ai_knowledge_chunks;
create policy "Authenticated users can read ai knowledge chunks"
  on public.ai_knowledge_chunks for select to authenticated using (true);

-- Policies cho Conversations (Chỉ chính chủ đọc/ghi)
drop policy if exists "Users can manage their own ai conversations" on public.ai_conversations;
create policy "Users can manage their own ai conversations"
  on public.ai_conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policies cho Messages (Chỉ thành viên trong cuộc trò chuyện đọc/ghi)
drop policy if exists "Users can manage their own ai messages" on public.ai_messages;
create policy "Users can manage their own ai messages"
  on public.ai_messages for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- 7. RPC Tìm kiếm tri thức Hybrid (Full-Text Search + Keyword Rank)
create or replace function public.search_ai_knowledge(
  p_query text,
  p_category text default null,
  p_limit int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  category text,
  content text,
  rank float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.title,
    d.category,
    c.content,
    ts_rank_cd(c.tsv, plainto_tsquery('simple', p_query))::float as rank
  from public.ai_knowledge_chunks c
  join public.ai_knowledge_documents d on d.id = c.document_id
  where (p_category is null or d.category = p_category)
    and (
      c.tsv @@ plainto_tsquery('simple', p_query)
      or c.content ilike '%' || p_query || '%'
      or d.title ilike '%' || p_query || '%'
    )
  order by rank desc, c.created_at asc
  limit p_limit;
$$;

-- 8. RPC Tối ưu cho AI: Tra cứu nhanh tồn kho (Gộp biến thể và vị trí kho)
create or replace function public.ai_get_stock_summary(
  p_query text default null,
  p_location_id uuid default null,
  p_limit int default 8
)
returns table (
  product_id uuid,
  variant_id uuid,
  product_name text,
  category_name text,
  attributes jsonb,
  unit text,
  price numeric,
  min_stock int,
  total_stock bigint,
  location_details text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    v.id as variant_id,
    p.name as product_name,
    coalesce(c.name, 'Chưa phân loại') as category_name,
    v.attributes,
    coalesce(v.unit, 'Cái') as unit,
    v.price,
    v.min_stock,
    coalesce(sum(sb.quantity), 0)::bigint as total_stock,
    coalesce(
      string_agg(
        distinct loc.name || ': ' || sb.quantity::text || ' ' || coalesce(v.unit, ''),
        ', '
      ),
      'Chưa có trong kho'
    ) as location_details
  from public.products p
  left join public.categories c on c.id = p.category_id
  join public.variants v on v.product_id = p.id
  left join public.stock_balances sb on sb.variant_id = v.id
  left join public.stock_locations loc on loc.id = sb.location_id
  where p.deleted_at is null
    and (
      p_query is null
      or p.name ilike '%' || p_query || '%'
      or coalesce(p.description, '') ilike '%' || p_query || '%'
      or v.attributes::text ilike '%' || p_query || '%'
    )
    and (p_location_id is null or sb.location_id = p_location_id)
  group by p.id, v.id, p.name, c.name, v.attributes, v.unit, v.price, v.min_stock
  order by total_stock desc, p.name asc
  limit p_limit;
$$;

-- 9. RPC Tối ưu cho AI: Thống kê tiêu hao nhiên liệu xăng dầu
create or replace function public.ai_get_fuel_summary(
  p_start_date date default null,
  p_end_date date default null,
  p_vehicle_id uuid default null,
  p_limit int default 10
)
returns table (
  dispense_id uuid,
  dispense_code text,
  dispense_date timestamptz,
  vehicle_name text,
  vehicle_code text,
  fuel_type_name text,
  quantity numeric,
  driver_name text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fd.id as dispense_id,
    fd.code as dispense_code,
    fd.created_at as dispense_date,
    coalesce(v.name, 'Thiết bị/Xe khác') as vehicle_name,
    coalesce(v.code, 'N/A') as vehicle_code,
    coalesce(ft.name, 'Nhiên liệu') as fuel_type_name,
    fd.quantity,
    coalesce(fd.driver_name, coalesce(v.default_driver, 'Chưa ghi nhận')) as driver_name,
    coalesce(fd.notes, '') as notes
  from public.fuel_dispenses fd
  left join public.vehicles v on v.id = fd.vehicle_id
  left join public.fuel_types ft on ft.id = fd.fuel_type_id
  where (p_start_date is null or fd.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or fd.created_at <= (p_end_date + interval '1 day')::timestamptz)
    and (p_vehicle_id is null or fd.vehicle_id = p_vehicle_id)
  order by fd.created_at desc
  limit p_limit;
$$;
