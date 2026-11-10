-- Saldo de ensaio: o stock clínico e o histórico de dispensas não são actualizados pelo POS.
CREATE UNIQUE INDEX IF NOT EXISTS nv_hospital_pharmacy_company_id ON public.hospital_pharmacy(empresa_id,id);
CREATE TABLE IF NOT EXISTS public.nv_pharmacy_pos_stock (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  lot_id uuid NOT NULL,
  initial_quantity numeric(16,3) NOT NULL CHECK(initial_quantity>0),
  quantity numeric(16,3) NOT NULL CHECK(quantity>=0 AND quantity<=initial_quantity),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(empresa_id,lot_id),
  FOREIGN KEY(empresa_id,lot_id) REFERENCES public.hospital_pharmacy(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS public.nv_pharmacy_pos_sales (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  invoice_id integer NOT NULL,
  prescription_id text NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(empresa_id,invoice_id),
  FOREIGN KEY(empresa_id,invoice_id) REFERENCES public.faturas(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS public.nv_pharmacy_pos_items (
  empresa_id uuid NOT NULL,
  invoice_id integer NOT NULL,
  item_id text NOT NULL,
  lot_id uuid NOT NULL,
  quantity numeric(16,3) NOT NULL CHECK(quantity>0),
  PRIMARY KEY(empresa_id,invoice_id,item_id,lot_id),
  FOREIGN KEY(empresa_id,invoice_id) REFERENCES public.nv_pharmacy_pos_sales(empresa_id,invoice_id),
  FOREIGN KEY(empresa_id,lot_id) REFERENCES public.nv_pharmacy_pos_stock(empresa_id,lot_id)
);
CREATE INDEX IF NOT EXISTS nv_pharmacy_pos_sales_prescription ON public.nv_pharmacy_pos_sales(empresa_id,prescription_id);
