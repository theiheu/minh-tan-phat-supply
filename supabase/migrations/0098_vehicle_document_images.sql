-- 0098_vehicle_document_images.sql
-- Thêm lưu trữ ảnh giấy tờ xe (cà vẹt, đăng kiểm, bảo hiểm, hình ảnh thực tế xe) cho danh mục phương tiện

-- 1. Thêm cột document_images vào bảng vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS document_images text[] DEFAULT '{}'::text[] NOT NULL;

-- 2. Đảm bảo storage bucket vehicle-documents tồn tại và có RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for vehicle-documents'
  ) THEN
    CREATE POLICY "Public Access for vehicle-documents" ON storage.objects
      FOR SELECT USING (bucket_id = 'vehicle-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload to vehicle-documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload to vehicle-documents" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update vehicle-documents'
  ) THEN
    CREATE POLICY "Authenticated users can update vehicle-documents" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'vehicle-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete from vehicle-documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete from vehicle-documents" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'vehicle-documents');
  END IF;
END $$;
